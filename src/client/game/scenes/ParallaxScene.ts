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

import ParallaxLayoutManager from "./parallax/ParallaxLayoutManager";
import ParallaxHudController from "./parallax/ParallaxHudController";
import ParallaxTaskFlowController from "./parallax/ParallaxTaskFlowController";
import type { ExtendedNetStateView, LayoutMetrics, Mode } from "./parallax/ParallaxTypes";
import { REGISTRY_DISPLAY_NAME, REGISTRY_AVATAR_DATA_URL } from "./PlayerSetupScene";

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
  private world!: WorldBuilder;
  private ui!: SceneUI;
  private momCtl!: MomController;
  private tasks!: TaskManager;
  private noamTasks!: NoamTaskManager;

  private layoutMgr = new ParallaxLayoutManager();
  private hudCtl!: ParallaxHudController;
  private taskFlow!: ParallaxTaskFlowController;

  private currentTurnName = "";
  private myPlayerIndex: number | null = null;
  /** האם המשחק כבר היה במצב ready פעם אחת (כלומר משחק רץ) */
  private netWasReady = false;

  private laneStartX = 0;
  private stepSizePx = 0;
  private groundY = 0;
  private totalWidth = 0;
  private laneOffsets: number[] = [];
  private playerTargetHeight = 70;

  private readonly MOVE_MS = 900;

  private readonly fixedDiceSeqPlayer0 = [5, 2, 3, 5, 6, 6];
  private fixedDiceSeqIndex0 = 0;

  private waitingSyncTimer: Phaser.Time.TimerEvent | null = null;
  private lastRollClickTs: number | null = null;

  constructor() {
    super("parallax-scene");
  }

  init(data: { mode?: Mode; playerCount?: number }) {
    this.mode = data.mode ?? (this.registry.get("mode") as Mode) ?? "local";
    this.playerCount =
      data.playerCount ?? (this.registry.get("playerCount") as number) ?? 1;

    console.log("[CLIENT][ParallaxScene] init", {
      mode: this.mode,
      playerCount: this.playerCount,
      ts: Date.now(),
    });
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
    this.load.image("dad", new URL("../../assets/dad.png", import.meta.url).toString());
    this.load.image("NOAM", new URL("../../assets/NOAM.png", import.meta.url).toString());
  }

  create() {
    console.log("[CLIENT][ParallaxScene] create start", { ts: Date.now() });

    this.cursors = this.input.keyboard!.createCursorKeys();

    const layout = this.layoutMgr.compute(this.scale.width, this.scale.height);
    this.applyLayoutValues(layout);

    this.world = new WorldBuilder(this);
    this.groundY = this.world.build({
      totalWidth: layout.totalWidth,
      brideKey: "bride",
      groundOffsetY: layout.groundOffsetY,
    }).groundY;

    this.ui = new SceneUI(this, {
      diceX: layout.diceX,
      diceY: layout.diceY,
      diceDepth: 10000,
      diceSize: layout.diceSize,
      initialName: "מיטול",
      initialEmoji: "🎲",
    });

    this.players = new PlayerManager(this);
    this.camCtl = new CameraController(this);
    this.camCtl.setWorldBounds(layout.totalWidth, layout.height);

    this.hudCtl = new ParallaxHudController(this, this.ui, this.players);

    this.players.spawn({
      textures: this.hudCtl.getTexturesForCount(this.mode, this.playerCount),
      groundY: this.groundY,
      laneStartX: this.laneStartX,
      laneOffsets: this.laneOffsets,
      targetHeight: this.playerTargetHeight,
    });

    this.camCtl.follow(this.players.getContainer(0));

    this.momCtl = new MomController(this);

    const isLocalIdx = (idx: number) => {
      const me = this.getMyIndex();
      return me !== null && idx === me;
    };

    this.tasks = new TaskManager(this, this.momCtl, {
      taskSteps: [3, 10],
      onTaskOpened: (_, type) => this.net?.sendTaskStarted?.(type),
      isBotPlayerIndex: (idx) => this.mode === "solo" && idx === 1,
      isLocalPlayerIndex: isLocalIdx,
      getStepWorldXY: (step) => ({
        x: this.laneStartX + (step - 1) * this.stepSizePx,
        y: this.groundY - Math.max(10, this.scale.height * 0.015),
      }),
      lock: () => this.lockForTask(),
      unlock: () => this.unlockAfterTask(),
    });

    this.noamTasks = new NoamTaskManager(this, {
      steps: [27, 30],
      onTaskOpened: (_, type) => this.net?.sendTaskStarted?.(type),
      isBotPlayerIndex: (idx) => this.mode === "solo" && idx === 1,
      isLocalPlayerIndex: isLocalIdx,
      getStepWorldXY: (step) => ({
        x: this.laneStartX + (step - 1) * this.stepSizePx,
        y: this.groundY - Math.max(10, this.scale.height * 0.015),
      }),
      lock: () => this.lockForTask(),
      unlock: () => this.unlockAfterTask(),
      onFailPenalty: (playerIndex, deltaSteps, done) => {
        console.log("[CLIENT][ParallaxScene] onFailPenalty", {
          playerIndex,
          deltaSteps,
          hasNet: !!this.net,
          ts: Date.now(),
        });

        if (!this.net) {
          this.playPenaltyMove(playerIndex, deltaSteps, done);
          return;
        }

        this.net.sendPenalty(deltaSteps);
        done();
      },
    });

    this.taskFlow = new ParallaxTaskFlowController({
      scene: this,
      mode: this.mode,
      getMyIndex: () => this.getMyIndex(),
      getNet: () => this.net,
      lockForTask: () => this.lockForTask(),
      unlockAfterTask: () => this.unlockAfterTask(),
      followMyPlayer: (delay = 80) => {
        this.time.delayedCall(delay, () => {
          const followIdx = this.getMyIndex() ?? 0;
          console.log("[CLIENT][ParallaxScene] followMyPlayer", {
            followIdx,
            delay,
            ts: Date.now(),
          });
          this.camCtl.follow(this.players.getContainer(followIdx));
        });
      },
      showSmallStatus: (message) => this.hudCtl.showSmallStatus(message),
      onPenaltyLocal: (playerIndex, deltaSteps, done) => {
        console.log("[CLIENT][ParallaxScene] onPenaltyLocal", {
          playerIndex,
          deltaSteps,
          ts: Date.now(),
        });
        this.playPenaltyMove(playerIndex, deltaSteps, done);
      },
      onRefreshHud: () => this.refreshHUD(),
    });

    this.attachNetOrSolo();

    const spaceKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    spaceKey?.on("down", () => {
      console.log("[CLIENT][ParallaxScene] SPACE pressed", {
        tasksLocked: this.tasks.isLocked(),
        noamLocked: this.noamTasks.isLocked(),
        seatingActive: this.taskFlow.hasActiveSeatingTask(),
        diceDisabled: this.ui.isDiceDisabled(),
        myIndex: this.getMyIndex(),
        canRollNow: this.net?.canRollNow?.(),
        ts: Date.now(),
      });

      if (this.tasks.isLocked()) return;
      if (this.noamTasks.isLocked()) return;
      if (this.taskFlow.hasActiveSeatingTask()) return;
      if (this.ui.isDiceDisabled()) return;

      if (this.net) {
        if (this.getMyIndex() === null) return;
        if (!this.net.canRollNow()) return;
      }

      this.ui.dice.tryRollFromInput();
    });

    this.ui.dice.onRoll(({ value }) => {
      const now = Date.now();
      this.lastRollClickTs = now;

      console.log("[CLIENT] roll clicked", {
        value,
        ts: now,
        mode: this.mode,
        myIndex: this.getMyIndex(),
      });

      if (this.tasks.isLocked() || this.noamTasks.isLocked()) return;
      if (this.taskFlow.hasActiveSeatingTask()) return;

      if (this.mode === "solo") return;

      let finalValue = value;
      const meIdx = this.getMyIndex();

      if (
        meIdx === 0 &&
        this.fixedDiceSeqIndex0 < this.fixedDiceSeqPlayer0.length
      ) {
        finalValue = this.fixedDiceSeqPlayer0[this.fixedDiceSeqIndex0++];
      }

      if (this.net) {
        if (this.getMyIndex() === null) return;
        if (!this.net.canRollNow()) return;

        this.ui.setDiceVisibleDeferred(true);

        console.log("[CLIENT] sending roll to server", {
          value: finalValue,
          myIndex: this.getMyIndex(),
          canRollNow: this.net.canRollNow(),
          ts: Date.now(),
        });

        this.net.sendRoll(finalValue);
        return;
      }

      this.playMoveTurn(0, finalValue);
    });

    this.refreshHUD();
    this.scale.on("resize", this.handleResize, this);

    console.log("[CLIENT][ParallaxScene] create end", { ts: Date.now() });
  }

  private applyLayoutValues(layout: LayoutMetrics) {
    this.laneStartX = layout.laneStartX;
    this.stepSizePx = layout.stepSizePx;
    this.totalWidth = layout.totalWidth;
    this.laneOffsets = layout.laneOffsets;
    this.playerTargetHeight = layout.playerTargetHeight;
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    console.log("[CLIENT][ParallaxScene] handleResize", {
      width: gameSize.width,
      height: gameSize.height,
      ts: Date.now(),
    });

    const layout = this.layoutMgr.compute(gameSize.width, gameSize.height);
    this.applyLayoutValues(layout);

    const worldResult = this.world?.resize({
      totalWidth: layout.totalWidth,
      groundOffsetY: layout.groundOffsetY,
      brideKey: "bride",
    });

    if (worldResult) {
      this.groundY = worldResult.groundY;
    }

    this.camCtl?.setWorldBounds(layout.totalWidth, layout.height);

    this.players?.relayout({
      groundY: this.groundY,
      laneStartX: this.laneStartX,
      stepSizePx: this.stepSizePx,
      laneOffsets: this.laneOffsets,
      targetHeight: this.playerTargetHeight,
      maxX: this.camCtl.getMaxXPadding(40),
    });

    this.ui?.resize();
    this.refreshHUD();

    const followIdx = this.getMyIndex() ?? 0;
    this.time.delayedCall(50, () => {
      this.camCtl?.follow(this.players?.getContainer(followIdx));
    });
  }

  private attachNetOrSolo() {
    console.log("[CLIENT][ParallaxScene] attachNetOrSolo", {
      mode: this.mode,
      playerCount: this.playerCount,
      ts: Date.now(),
    });

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

    console.log("[CLIENT][ParallaxScene] registry room/net", {
      hasRoom: !!room,
      hasExistingNet: !!existingNet,
      ts: Date.now(),
    });

    if (!room) {
      this.game.events.once("room-ready", () => {
        const r = this.registry.get("room") as Room | undefined;
        const net = this.registry.get("net") as NetGameController | undefined;
        console.log("[CLIENT][ParallaxScene] room-ready event", {
          hasRoom: !!r,
          hasNet: !!net,
          ts: Date.now(),
        });
        if (r) this.attachNet(r, net);
      });
      return;
    }

    this.attachNet(room, existingNet);
  }

  private attachNet(room: Room, existingNet?: NetGameController) {
    console.log("[CLIENT][ParallaxScene] attachNet", {
      hasExistingNet: !!existingNet,
      roomId: (room as any)?.roomId,
      sessionId: (room as any)?.sessionId,
      ts: Date.now(),
    });

    this.room = room;
    this.net = existingNet ?? new NetGameController(room, this.playerCount);

    const displayName = this.registry.get(REGISTRY_DISPLAY_NAME) as string | undefined;
    const avatarDataUrl = this.registry.get(REGISTRY_AVATAR_DATA_URL) as string | undefined;

    if (displayName || avatarDataUrl) {
      this.net.sendPlayerMeta(displayName, avatarDataUrl);
    }

    const applyNetState = (rawState: NetStateView) => {
      const s = rawState as ExtendedNetStateView;

      console.log("[CLIENT] applyNetState", {
        myIndexBefore: this.myPlayerIndex,
        stateMyIndex: s.myIndex,
        currentTurn: s.currentTurn,
        canRollNow: s.canRollNow,
        ready: s.ready,
        names: s.names,
        ts: Date.now(),
      });

      if (!s.ready) {
        console.log("[CLIENT] applyNetState => not ready", {
          myIndex: this.myPlayerIndex,
          currentTurn: s.currentTurn,
          netWasReady: this.netWasReady,
          ts: Date.now(),
        });

        // אם המשחק כבר היה במצב ready (שתי שחקניות) ועכשיו ready=false → מישהי התנתקה באמצע משחק.
        // נחזיר בעדינות לתפריט, במקום להשאיר מחכה לנצח.
        if (this.netWasReady) {
          this.ui.setDicePlayer("מחכה לשחקניות…", "⏳");
          this.ui.setDiceDisabled(true);
          this.ui.setDiceVisibleDeferred(false);
          this.currentTurnName = "שחקנית התנתקה – חוזרים לתפריט";
          this.refreshHUD();

          this.time.delayedCall(1800, () => {
            console.log("[CLIENT] other player disconnected → back to menu", {
              ts: Date.now(),
            });
            this.scene.start("menu-scene");
          });
          return;
        }

        // לפני שהמשחק התחיל (עדיין מחכים לשחקנים)
        this.ui.setDicePlayer("מחכה לשחקנים…", "⏳");
        this.ui.setDiceDisabled(true);
        this.ui.setDiceVisibleDeferred(false);
        this.currentTurnName = "מחכה לשחקנים…";
        this.refreshHUD();

        if (!this.waitingSyncTimer && this.net) {
          this.waitingSyncTimer = this.time.addEvent({
            delay: 1500,
            callback: () => {
              console.log("[CLIENT] waitingSyncTimer requestSync", {
                ts: Date.now(),
              });
              this.net?.requestSync?.();
            },
            loop: true,
          });
        }
        return;
      }

      if (this.waitingSyncTimer) {
        this.waitingSyncTimer.destroy();
        this.waitingSyncTimer = null;
      }

      // סימון שהמשחק כבר היה מוכן – אם אחר כך ready=false נדע שמישהי התנתקה
      this.netWasReady = true;

      if (s.myIndex !== null && s.myIndex !== undefined) {
        this.myPlayerIndex = s.myIndex;
      }

      const fallbackNames = this.hudCtl.getCharNames(
        this.mode,
        this.playerCount,
        this.myPlayerIndex
      );

      const names =
        s.names && s.names.length
          ? s.names.map((n, i) => n ?? fallbackNames[i] ?? "שחקן")
          : fallbackNames;

      const emojis = ["👧", "🐶", "🐻", "🎮"];

      try {
        const avatars = s.avatars ?? [];
        avatars.forEach((dataUrl, idx) => {
          if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
            return;
          }

          const key = `player-avatar-${idx}`;
          if (!this.textures.exists(key)) {
            this.textures.once("addtexture", (texKey: string) => {
              if (texKey === key) this.players?.setPlayerTexture(idx, key);
            });
            this.textures.addBase64(key, dataUrl);
          } else {
            this.players?.setPlayerTexture(idx, key);
          }
        });
      } catch {}

      const me = this.getMyIndex();
      const myIdxForUI = me ?? 0;
      const myName = names[myIdxForUI] ?? "שחקן";
      const myEmoji = emojis[myIdxForUI] ?? "🎮";

      console.log("[CLIENT] ui player/canRoll decision", {
        me,
        myIdxForUI,
        myName,
        currentTurn: s.currentTurn,
        canRollNow: s.canRollNow,
        tasksLocked: this.tasks.isLocked(),
        noamLocked: this.noamTasks.isLocked(),
        seatingActive: this.taskFlow.hasActiveSeatingTask(),
        ts: Date.now(),
      });

      this.ui.setDicePlayer(myName, myEmoji);

      if (me === null) {
        this.ui.setDiceDisabled(true);
        this.ui.setDiceVisibleDeferred(false);
      } else if (
        !this.tasks.isLocked() &&
        !this.noamTasks.isLocked() &&
        !this.taskFlow.hasActiveSeatingTask()
      ) {
        this.ui.setDiceDisabled(!s.canRollNow);
        this.ui.setDiceVisibleDeferred(s.canRollNow);
      }

      this.currentTurnName = names[s.currentTurn] ?? "";
      this.refreshHUD();

      console.log("[CLIENT] applyNetState => after UI update", {
        me,
        currentTurnName: this.currentTurnName,
        diceDisabled: this.ui.isDiceDisabled(),
        ts: Date.now(),
      });

      if (me !== null) {
        this.camCtl.follow(this.players.getContainer(me));
      }
    };

    this.net.on("state", applyNetState);
    applyNetState(this.net.getState());

    this.time.delayedCall(400, () => {
      console.log("[CLIENT] delayed requestSync after attachNet", { ts: Date.now() });
      this.net?.requestSync?.();
    });

    this.net.on(
      "move",
      ({ playerIndex, value }: { playerIndex: number; value: number }) => {
        const now = Date.now();
        if (this.lastRollClickTs !== null) {
          console.log("[CLIENT] latency click→move(ms)", now - this.lastRollClickTs, {
            playerIndex,
            value,
          });
        }

        console.log("[CLIENT][ParallaxScene] net move listener", {
          playerIndex,
          value,
          ts: now,
        });

        this.playMoveTurn(playerIndex, value);
      }
    );

    this.net.on(
      "penaltyMove",
      ({
        playerIndex,
        deltaSteps,
      }: {
        playerIndex: number;
        deltaSteps: number;
      }) => {
        console.log("[CLIENT][ParallaxScene] net penaltyMove listener", {
          playerIndex,
          deltaSteps,
          ts: Date.now(),
        });
        this.playPenaltyMove(playerIndex, deltaSteps);
      }
    );

    this.net.on(
      "taskStarted",
      ({ type, playerIndex }: { type: "mom" | "noam"; playerIndex: number }) => {
        console.log("[CLIENT][ParallaxScene] net taskStarted listener", {
          type,
          playerIndex,
          myIndex: this.getMyIndex(),
          ts: Date.now(),
        });

        const me = this.getMyIndex();
        if (me !== null && playerIndex === me) return;

        const name = this.getPlayerDisplayName(playerIndex);

        if (type === "mom") {
          const { x, y } = this.getStepWorldXY(10);
          this.momCtl.showMomWithSpeech({
            x,
            y,
            depth: 400,
            targetHeightPx: 400,
            speechText: `${name} עוזר/ת לי כרגע... מיד יתפנה אליכן.`,
          });
          this.time.delayedCall(3000, () => this.momCtl.hideAnimated());
        } else {
          this.noamTasks.showBusyMessage(name);
        }
      }
    );
  }

  private getStepWorldXY(step: number): { x: number; y: number } {
    return {
      x: this.laneStartX + (step - 1) * this.stepSizePx,
      y: this.groundY - Math.max(10, this.scale.height * 0.015),
    };
  }

  private getPlayerDisplayName(playerIndex: number): string {
    const fallback = this.hudCtl.getCharNames(
      this.mode,
      this.playerCount,
      this.myPlayerIndex
    );
    const fromNet = this.net?.getState?.().names;
    if (fromNet && fromNet[playerIndex] != null && fromNet[playerIndex] !== "") {
      return fromNet[playerIndex] ?? fallback[playerIndex] ?? "שחקן";
    }
    return fallback[playerIndex] ?? "שחקן";
  }

  private attachSolo() {
    console.log("[CLIENT][ParallaxScene] attachSolo", { ts: Date.now() });

    this.soloMatch = new SoloVsBotMatch(this, this.ui.dice as never, {
      name: "מיטול",
      emoji: "👰‍♀️",
    });

    this.soloMatch.on(
      "turn-changed",
      (e: { player: { isBot: boolean; name: string } }) => {
        console.log("[CLIENT][ParallaxScene] solo turn-changed", {
          isBot: e.player.isBot,
          name: e.player.name,
          ts: Date.now(),
        });

        this.soloIsBotTurn = e.player.isBot;
        this.currentTurnName = e.player.name;

        this.ui.setDiceVisibleDeferred(!e.player.isBot);
        this.ui.setDiceDisabled(e.player.isBot);

        this.refreshHUD();
      }
    );

    this.soloMatch.on(
      "dice-rolled",
      (e: { player: { name: string }; value: number }) => {
        console.log("[CLIENT][ParallaxScene] solo dice-rolled", {
          playerName: e.player.name,
          value: e.value,
          ts: Date.now(),
        });

        const idx = e.player.name === "מיטול" ? 0 : 1;
        this.playMoveTurn(idx, e.value, () => this.soloMatch?.advanceTurn());
      }
    );

    this.soloMatch.start();
  }

  private playMoveTurn(
    playerIndex: number,
    diceValue: number,
    onTurnFinished?: () => void
  ) {
    console.log("[CLIENT][ParallaxScene] playMoveTurn start", {
      playerIndex,
      diceValue,
      myIndex: this.getMyIndex(),
      ts: Date.now(),
    });

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
        console.log("[CLIENT][ParallaxScene] playMoveTurn onComplete", {
          playerIndex,
          diceValue,
          stepsNow: this.players.getSteps(playerIndex),
          ts: Date.now(),
        });

        this.ui.setMoving(false);

        const stepsNow = this.players.getSteps(playerIndex);

        this.tasks.handleAfterMove(playerIndex, stepsNow, () => {
          console.log("[CLIENT][ParallaxScene] tasks.handleAfterMove done", {
            playerIndex,
            stepsNow,
            ts: Date.now(),
          });

          this.taskFlow.handleWeddingSeatingAfterMove(playerIndex, stepsNow, () => {
            console.log("[CLIENT][ParallaxScene] taskFlow.handleWeddingSeatingAfterMove done", {
              playerIndex,
              stepsNow,
              ts: Date.now(),
            });

            this.noamTasks.handleAfterMove(playerIndex, stepsNow, () => {
              console.log("[CLIENT][ParallaxScene] noamTasks.handleAfterMove done", {
                playerIndex,
                stepsNow,
                ts: Date.now(),
              });

              const followIdx = this.getMyIndex() ?? 0;

              this.refreshHUD();
              this.time.delayedCall(100, () =>
                this.camCtl.follow(this.players.getContainer(followIdx))
              );

              this.ui.flushPendingDiceVisibility();
              onTurnFinished?.();
            });
          });
        });
      },
    });
  }

  private playPenaltyMove(
    playerIndex: number,
    deltaSteps: number,
    done?: () => void
  ) {
    console.log("[CLIENT][ParallaxScene] playPenaltyMove start", {
      playerIndex,
      deltaSteps,
      ts: Date.now(),
    });

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
        console.log("[CLIENT][ParallaxScene] playPenaltyMove onComplete", {
          playerIndex,
          deltaSteps,
          ts: Date.now(),
        });

        this.ui.setMoving(false);

        const followIdx = this.getMyIndex() ?? 0;
        this.time.delayedCall(80, () =>
          this.camCtl.follow(this.players.getContainer(followIdx))
        );

        this.refreshHUD();
        done?.();
      },
    });
  }

  private lockForTask() {
    console.log("[CLIENT][ParallaxScene] lockForTask", {
      myIndex: this.getMyIndex(),
      ts: Date.now(),
    });

    this.ui.setDiceDisabled(true);
    this.ui.setDiceVisibleDeferred(false);
    this.soloMatch?.setPaused(true);
  }

  private unlockAfterTask() {
    console.log("[CLIENT][ParallaxScene] unlockAfterTask", {
      mode: this.mode,
      myIndex: this.getMyIndex(),
      ts: Date.now(),
    });

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

      console.log("[CLIENT][ParallaxScene] unlockAfterTask net restore", {
        me,
        can,
        ts: Date.now(),
      });

      this.ui.setDiceDisabled(!can);
      this.ui.setDiceVisibleDeferred(can);
      this.refreshHUD();
      return;
    }

    this.ui.setDiceDisabled(false);
    this.ui.setDiceVisibleDeferred(true);
    this.refreshHUD();
  }

  private getMyIndex(): number | null {
    if (this.mode === "solo") return 0;
    return this.myPlayerIndex;
  }

  private refreshHUD() {
    console.log("[CLIENT][ParallaxScene] refreshHUD", {
      mode: this.mode,
      playerCount: this.playerCount,
      myPlayerIndex: this.myPlayerIndex,
      currentTurnName: this.currentTurnName,
      ts: Date.now(),
    });

    this.hudCtl.refresh({
      mode: this.mode,
      playerCount: this.playerCount,
      myPlayerIndex: this.myPlayerIndex,
      currentTurnName: this.currentTurnName,
    });
  }

  shutdown() {
    console.log("[CLIENT][ParallaxScene] shutdown", {
      ts: Date.now(),
      roomId: (this.room as any)?.roomId,
      sessionId: (this.room as any)?.sessionId,
    });

    try {
      this.room?.leave();
    } catch {}

    this.scale.off("resize", this.handleResize, this);

    this.net?.destroy();
    this.net = undefined;

    this.soloMatch?.destroy();
    this.soloMatch = undefined;

    this.taskFlow?.destroy();

    this.tasks?.destroy();
    this.noamTasks?.destroy();

    this.world?.destroy();
    this.players?.destroy();
    this.momCtl?.destroy();
    this.ui?.destroy();
  }

  update() {
    if (
      this.tasks?.isLocked() ||
      this.noamTasks?.isLocked() ||
      this.taskFlow?.hasActiveSeatingTask()
    ) {
      return;
    }

    const cam = this.cameras.main;
    const speed = Math.max(8, this.scale.width * 0.008);

    if (this.cursors.left?.isDown) cam.scrollX -= speed;
    else if (this.cursors.right?.isDown) cam.scrollX += speed;
  }
}