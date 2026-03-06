// src/client/game/scenes/ParallaxScene.ts
import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";

import PlayerManager from "../controllers/PlayerManager";
import CameraController from "../controllers/CameraController";
import MomController from "../controllers/MomController";

import WorldBuilder from "../controllers/WorldBuilder";
import SceneUI from "../controllers/SceneUI";
import TaskManager from "../controllers/TaskManager";
import NoamTaskManager from "../controllers/NoamTaskManager";

import NetGameController, { type NetStateView } from "../controllers/NetGameController";
import SoloVsBotMatch from "../match/SoloVsBotMatch";

type Mode = "solo" | "local";

export default class ParallaxScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private mode: Mode = "local";
  private playerCount = 1;

  private room?: Room;
  private net?: NetGameController;

  private soloMatch?: SoloVsBotMatch;
  private soloIsBotTurn = false;

  private players!: PlayerManager;
  private camCtl!: CameraController;

  private ui!: SceneUI;
  private momCtl!: MomController;

  private tasks!: TaskManager;
  private noamTasks!: NoamTaskManager;

  private currentTurnName = "";

  // ✅ קריטי: עד שלא הגיע assign מהשרת — אין שחקן מקומי
  private myPlayerIndex: number | null = null;

  private laneStartX = 90;
  private stepSizePx = 90;
  private groundY = 0;

  private readonly MOVE_MS = 2000;

  // רצף קבוע לשחקנית 0 (הילדה) לצורך בדיקות
  private readonly fixedDiceSeqPlayer0 = [5, 2, 3, 6, 5, 6];
  private fixedDiceSeqIndex0 = 0;

  constructor() {
    super("parallax-scene");
  }

  init(data: { mode?: Mode; playerCount?: number }) {
    this.mode = data.mode ?? (this.registry.get("mode") as Mode) ?? "local";
    this.playerCount = data.playerCount ?? (this.registry.get("playerCount") as number) ?? 1;
  }

  preload() {
    this.load.image("sky", new URL("../../assets/sky.png", import.meta.url).toString());
    this.load.image("plateau", new URL("../../assets/plateau.png", import.meta.url).toString());
    this.load.image("ground", new URL("../../assets/ground.png", import.meta.url).toString());
    this.load.image("plants", new URL("../../assets/plant.png", import.meta.url).toString());
    this.load.image("bride", new URL("../../assets/brideNeon.png", import.meta.url).toString());

    this.load.image("ילדה", new URL("../../assets/ילדה.png", import.meta.url).toString());
    this.load.image("כלב", new URL("../../assets/כלב.png", import.meta.url).toString());
    this.load.image("דוב", new URL("../../assets/דוב.png", import.meta.url).toString());

    this.load.image("MOM", new URL("../../assets/MOM.png", import.meta.url).toString());
    this.load.image("NOAM", new URL("../../assets/NOAM.png", import.meta.url).toString());
  }

  create() {
    this.cursors = this.input.keyboard!.createCursorKeys();

    const { width, height } = this.scale;
    const totalWidth = width * 10;

    // World
    const world = new WorldBuilder(this);
    this.groundY = world.build({ totalWidth, brideKey: "bride", groundOffsetY: 90 }).groundY;

    // UI
    this.ui = new SceneUI(this, {
      diceX: width / 2,
      diceY: height / 2,
      diceDepth: 10000,
      diceSize: 64,
      initialName: "מיטול",
      initialEmoji: "🎲",
    });

    // Managers
    this.players = new PlayerManager(this);
    this.camCtl = new CameraController(this);
    this.camCtl.setWorldBounds(totalWidth, height);

    // Spawn players
    this.players.spawn({
      textures: this.getTexturesForCount(),
      groundY: this.groundY,
      laneStartX: this.laneStartX,
    });
    this.camCtl.follow(this.players.getContainer(0));

    // Mom + tasks
    this.momCtl = new MomController(this);

    // ✅ isLocalPlayerIndex חייב להיות חסין ל-null
    const isLocalIdx = (idx: number) => {
      const me = this.getMyIndex();
      return me !== null && idx === me;
    };

    this.tasks = new TaskManager(this, this.momCtl, {
      taskSteps: [3, 10],

      isBotPlayerIndex: (idx) => this.mode === "solo" && idx === 1,
      isLocalPlayerIndex: isLocalIdx,

      getStepWorldXY: (step) => ({
        x: this.laneStartX + (step - 1) * this.stepSizePx,
        y: this.groundY - 10,
      }),

      lock: () => this.lockForTask(),
      unlock: () => this.unlockAfterTask(),
    });

    this.noamTasks = new NoamTaskManager(this, {
      steps: [27, 30],

      isBotPlayerIndex: (idx) => this.mode === "solo" && idx === 1,
      isLocalPlayerIndex: isLocalIdx,

      getStepWorldXY: (step) => ({
        x: this.laneStartX + (step - 1) * this.stepSizePx,
        y: this.groundY - 10,
      }),

      lock: () => this.lockForTask(),
      unlock: () => this.unlockAfterTask(),

      onFailPenalty: (playerIndex, deltaSteps, done) => {
        if (!this.net) {
          this.playPenaltyMove(playerIndex, deltaSteps, done);
          return;
        }

        // Network: continue turn immediately so next player gets the dice; penalty animation runs when penaltyMove arrives
        this.net.sendPenalty(deltaSteps);
        done();
      },
    });

    // Attach net/solo
    this.attachNetOrSolo();

    // SPACE roll
    const spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey?.on("down", () => {
      if (this.tasks.isLocked()) return;
      if (this.noamTasks.isLocked()) return;
      if (this.ui.isDiceDisabled()) return;

      if (this.net) {
        // ✅ אם עדיין אין assign, לא לגלגל
        if (this.getMyIndex() === null) return;
        if (!this.net.canRollNow()) return;
      }

      this.ui.dice.tryRollFromInput();
    });

    // Dice roll
    this.ui.dice.onRoll(({ value }) => {
      if (this.tasks.isLocked() || this.noamTasks.isLocked()) return;

      // SOLO מנוהל ע"י match
      if (this.mode === "solo") return;

      // רצף קבוע לשחקן 0 בלבד (עד 6 גלגולים ראשונים)
      let finalValue = value;
      const meIdx = this.getMyIndex();
      if (meIdx === 0 && this.fixedDiceSeqIndex0 < this.fixedDiceSeqPlayer0.length) {
        finalValue = this.fixedDiceSeqPlayer0[this.fixedDiceSeqIndex0++];
      }

      // Network: שולחים לשרת ומחכים ל-"move" חזרה ממנו
      if (this.net) {
        if (this.getMyIndex() === null) return; // ✅ אין assign
        if (!this.net.canRollNow()) return;

        this.ui.setDiceVisibleDeferred(true);
        this.net.sendRoll(finalValue);
        return;
      }

      // fallback local single
      this.playMoveTurn(0, finalValue);
    });

    this.refreshHUD();
    this.scale.on("resize", () => this.ui.resize());
  }

  // ---------------- attach net/solo ----------------

  private attachNetOrSolo() {
    if (this.mode === "solo") {
      this.attachSolo();
      return;
    }

    if (this.playerCount === 1) {
      this.currentTurnName = "תור שלך";
      return;
    }

    const room = this.registry.get("room") as Room | undefined;
    const existingNet = this.registry.get("net") as NetGameController | undefined;
    if (!room) {
      this.game.events.once("room-ready", () => {
        const r = this.registry.get("room") as Room | undefined;
        const net = this.registry.get("net") as NetGameController | undefined;
        if (r) this.attachNet(r, net);
      });
      return;
    }

    this.attachNet(room, existingNet);
  }

  private attachNet(room: Room, existingNet?: NetGameController) {
    this.room = room;
    this.net = existingNet ?? new NetGameController(room, this.playerCount);

    this.net.on("state", (s: NetStateView) => {
      if (!s.ready) {
        this.ui.setDicePlayer("מחכה לשחקנים…", "⏳");
        this.ui.setDiceDisabled(true);
        this.ui.setDiceVisibleDeferred(false);
        this.currentTurnName = "מחכה לשחקנים…";
        this.refreshHUD();
        return;
      }

      // ✅ מקבלים assign מהשרת
      if (s.myIndex !== null && s.myIndex !== undefined) {
        this.myPlayerIndex = s.myIndex;
      }

      const names = this.getCharNames();
      const emojis = ["👧", "🐶", "🐻", "🎮"];

      const me = this.getMyIndex();
      const myIdxForUI = me ?? 0; // רק לתצוגה עד assign

      const myName = names[myIdxForUI] ?? "שחקן";
      const myEmoji = emojis[myIdxForUI] ?? "🎮";
      this.ui.setDicePlayer(myName, myEmoji);

      // ✅ אם אין assign עדיין, לא מאפשרים גלגול
      if (me === null) {
        this.ui.setDiceDisabled(true);
        this.ui.setDiceVisibleDeferred(false);
      } else if (!this.tasks.isLocked() && !this.noamTasks.isLocked()) {
        this.ui.setDiceDisabled(!s.canRollNow);
        this.ui.setDiceVisibleDeferred(s.canRollNow);
      }

      this.currentTurnName = names[s.currentTurn] ?? "";
      this.refreshHUD();

      // follow רק אם יש assign
      if (me !== null) {
        this.camCtl.follow(this.players.getContainer(me));
      }
    });

    this.net.on("move", ({ playerIndex, value }: { playerIndex: number; value: number }) => {
      this.playMoveTurn(playerIndex, value);
    });

    this.net.on("penaltyMove", ({ playerIndex, deltaSteps }: { playerIndex: number; deltaSteps: number }) => {
      this.playPenaltyMove(playerIndex, deltaSteps);
    });
  }

  private attachSolo() {
    this.soloMatch = new SoloVsBotMatch(this, this.ui.dice as any, { name: "מיטול", emoji: "👰‍♀️" });

    this.soloMatch.on("turn-changed", (e: { player: { isBot: boolean; name: string } }) => {
      this.soloIsBotTurn = e.player.isBot;
      this.currentTurnName = e.player.name;

      this.ui.setDiceVisibleDeferred(!e.player.isBot);
      this.ui.setDiceDisabled(e.player.isBot);

      this.refreshHUD();
    });

    this.soloMatch.on("dice-rolled", (e: { player: { name: string }; value: number }) => {
      const idx = e.player.name === "מיטול" ? 0 : 1;
      this.playMoveTurn(idx, e.value, () => this.soloMatch?.advanceTurn());
    });

    this.soloMatch.start();
  }

  // ---------------- turns / movement ----------------

  private playMoveTurn(playerIndex: number, diceValue: number, onTurnFinished?: () => void) {
    this.ui.setLastRoll(diceValue);
    this.ui.setMoving(true);

    this.players.moveByDice({
      playerIndex,
      diceValue,
      laneStartX: this.laneStartX,
      stepSizePx: this.stepSizePx,
      maxX: this.camCtl.getMaxXPadding(40),
      duration: this.MOVE_MS,

      onComplete: () => {
        this.ui.setMoving(false);

        const stepsNow = this.players.getSteps(playerIndex);

        // שרשרת משימות: אמא → נועם
        this.tasks.handleAfterMove(playerIndex, stepsNow, () => {
          this.noamTasks.handleAfterMove(playerIndex, stepsNow, () => {
            const followIdx = this.getMyIndex() ?? 0;

            this.refreshHUD();
            this.time.delayedCall(100, () => this.camCtl.follow(this.players.getContainer(followIdx)));

            this.ui.flushPendingDiceVisibility();
            onTurnFinished?.();
          });
        });
      },
    });
  }

  private playPenaltyMove(playerIndex: number, deltaSteps: number, done?: () => void) {
    this.ui.setMoving(true);

    this.players.moveByDice({
      playerIndex,
      diceValue: deltaSteps,
      laneStartX: this.laneStartX,
      stepSizePx: this.stepSizePx,
      maxX: this.camCtl.getMaxXPadding(40),
      duration: 850,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.ui.setMoving(false);

        const followIdx = this.getMyIndex() ?? 0;
        this.time.delayedCall(80, () => this.camCtl.follow(this.players.getContainer(followIdx)));

        this.refreshHUD();
        done?.();
      },
    });
  }

  // ---------------- lock/unlock ----------------

  private lockForTask() {
    this.ui.setDiceDisabled(true);
    this.ui.setDiceVisibleDeferred(false);

    // SOLO: להקפיא בוט בזמן משימה
    this.soloMatch?.setPaused(true);
  }

  private unlockAfterTask() {
    if (this.mode === "solo") {
      this.soloMatch?.setPaused(false);
      this.ui.setDiceDisabled(this.soloIsBotTurn);
      this.ui.setDiceVisibleDeferred(!this.soloIsBotTurn);
      this.refreshHUD();
      return;
    }

    if (this.net) {
      const me = this.getMyIndex();
      if (me === null) {
        this.ui.setDiceDisabled(true);
        this.ui.setDiceVisibleDeferred(false);
        this.refreshHUD();
        return;
      }

      const can = this.net.canRollNow();
      this.ui.setDiceDisabled(!can);
      this.ui.setDiceVisibleDeferred(can);
      this.refreshHUD();
      return;
    }

    this.ui.setDiceDisabled(false);
    this.ui.setDiceVisibleDeferred(true);
    this.refreshHUD();
  }

  // ---------------- identity / hud ----------------

  private getMyIndex(): number | null {
    if (this.mode === "solo") return 0;
    return this.myPlayerIndex;
  }

  private refreshHUD() {
    const names = this.getCharNames();

    const me = this.getMyIndex();
    const myIdx = me ?? 0;

    const myName = names[myIdx] ?? "שחקן";
    const points = this.players.getSteps(myIdx);

    const icons = ["👧", "🐶", "🐻", "🎮"];
    const icon = icons[myIdx] ?? "🎮";

    const myLine = `${icon} ${myName}  •  ${points} נק'`;
    const turnLine = this.currentTurnName ? `🎯 תור  ·  ${this.currentTurnName}` : "";

    this.ui.setHUD(myLine, turnLine);
  }

  private getCharNames(): string[] {
    if (this.mode === "solo") return ["מיטול", "בוטית רעה"];
    if (this.playerCount === 1) return ["ילדה"];
    if (this.playerCount === 2) return ["ילדה", "כלב"];
    if (this.playerCount === 3) return ["ילדה", "כלב", "דוב"];
    return ["ילדה", "כלב", "דוב", "שחקן 4"];
  }

  private getTexturesForCount() {
    if (this.mode === "solo") return ["ילדה", "כלב"];
    if (this.playerCount === 1) return ["ילדה"];
    if (this.playerCount === 2) return ["ילדה", "כלב"];
    if (this.playerCount === 3) return ["ילדה", "כלב", "דוב"];
    return ["ילדה", "כלב", "דוב", "דוב"];
  }

  // ---------------- cleanup ----------------

  shutdown() {
    try {
      this.room?.leave();
    } catch {}

    this.net?.destroy();
    this.net = undefined;

    this.soloMatch?.destroy();
    this.soloMatch = undefined;

    this.tasks?.destroy();
    this.noamTasks?.destroy();

    this.players?.destroy();
    this.momCtl?.destroy();
    this.ui?.destroy();
  }

  update() {
    if (this.tasks?.isLocked() || this.noamTasks?.isLocked()) return;

    const cam = this.cameras.main;
    const speed = 10;

    if (this.cursors.left?.isDown) cam.scrollX -= speed;
    else if (this.cursors.right?.isDown) cam.scrollX += speed;
  }
}