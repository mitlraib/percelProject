import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";

import PlayerManager from "../controllers/PlayerManager";
import CameraController from "../controllers/CameraController";
import MomController from "../controllers/MomController";
import WorldBuilder from "../controllers/WorldBuilder";
import SceneUI from "../controllers/SceneUI";
import TaskManager from "../controllers/TaskManager";
import NoamTaskManager from "../controllers/NoamTaskManager";
import NetGameController, {
  type NetStateView,
} from "../controllers/NetGameController";
import SoloVsBotMatch from "../match/SoloVsBotMatch";

import ParallaxLayoutManager from "./parallax/ParallaxLayoutManager";
import ParallaxHudController from "./parallax/ParallaxHudController";
import ParallaxTaskFlowController from "./parallax/ParallaxTaskFlowController";
import ParallaxModeController from "./parallax/ParallaxModeController";
import ParallaxOverlayController from "./parallax/ParallaxOverlayController";

import type {
  ExtendedNetStateView,
  LayoutMetrics,
  Mode,
} from "./parallax/ParallaxTypes";

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

  private modeCtl!: ParallaxModeController;
  private movementCtl!: ParallaxMovementController;
  private overlayCtl!: ParallaxOverlayController;

  private currentTurnName = "";
  private myPlayerIndex: number | null = null;

  /** האם המשחק כבר היה במצב ready פעם אחת */
  private netWasReady = false;

  /** כדי לא לחזור כמה פעמים לתפריט */
  private leavingToMenu = false;

  private laneStartX = 0;
  private stepSizePx = 0;
  private groundY = 0;
  private totalWidth = 0;
  private laneOffsets: number[] = [];
  private playerTargetHeight = 70;

  private isGameBlockedForPortrait = false;

  // מהירות תנועת השחקנים קדימה – מעט יותר איטית
  private readonly MOVE_MS = 1350;

  // תמונת אווטאר מקומית (לא עוברת דרך השרת, רק אצל השחקן עצמו)
  private localAvatarDataUrl: string | null = null;

  // רצף קבוע עבור קלי:
  // 5,2,3,3,2,5,3,4,3 => 5 → 7 → 10 (אמא) → 13 → 15 (אבא) → 20 → 23 → 27 (נועם) → 30 (סיום)
  private readonly fixedDiceSeqPlayer0 = [5, 2, 3, 3, 2, 5, 3, 4, 3];
  private fixedDiceSeqIndex0 = 0;
  private static readonly KALI_NAME = "קלי";

  private waitingSyncTimer: Phaser.Time.TimerEvent | null = null;
  private lastRollClickTs: number | null = null;

  // שלב סופי – שאלה אחרונה ב-30 צעדים
  private finalQuestionActive = false;
  private finalQuestionCompleted = false;

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
    this.load.image(
      "sky",
      new URL("../../assets/sky.png", import.meta.url).toString()
    );
    this.load.image(
      "plateau",
      new URL("../../assets/plateau.png", import.meta.url).toString()
    );
    this.load.image(
      "ground",
      new URL("../../assets/ground.png", import.meta.url).toString()
    );
    this.load.image(
      "plants",
      new URL("../../assets/plant.png", import.meta.url).toString()
    );
    this.load.image(
      "bride",
      new URL("../../assets/brideNeon.png", import.meta.url).toString()
    );

    this.load.image(
      "ילדה",
      new URL("../../assets/ילדה.png", import.meta.url).toString()
    );
    this.load.image(
      "כלב",
      new URL("../../assets/כלב.png", import.meta.url).toString()
    );
    this.load.image(
      "דוב",
      new URL("../../assets/דוב.png", import.meta.url).toString()
    );

    this.load.image(
      "MOM",
      new URL("../../assets/MOM.png", import.meta.url).toString()
    );
    this.load.image(
      "dad",
      new URL("../../assets/dad.png", import.meta.url).toString()
    );
    this.load.image(
      "NOAM",
      new URL("../../assets/NOAM.png", import.meta.url).toString()
    );

    this.load.image(
      "KALI",
      new URL("../../assets/KALI.png", import.meta.url).toString()
    );
  }

  create() {
    console.log("[CLIENT][ParallaxScene] create start", { ts: Date.now() });

    window.addEventListener("error", (e) => {
      console.log("[CLIENT] window error", {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        ts: Date.now(),
      });
    });

    window.addEventListener("unhandledrejection", (e) => {
      console.log("[CLIENT] unhandledrejection", {
        reason: String(e.reason),
        ts: Date.now(),
      });
    });

    this.cursors = this.input.keyboard!.createCursorKeys();

    const layout = this.layoutMgr.compute(this.scale.width, this.scale.height);
    if (this.isMobileDevice()) {
      layout.groundOffsetY = 0;
    }
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

    // שמות מתחת לכל שחקן
    const initialNames = Array.from({ length: this.playerCount }, (_, i) =>
      this.getPlayerDisplayName(i)
    );
    this.players.setPlayerNames(initialNames);

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
      getStepWorldXY: (step) => this.getStepWorldXY(step),
      lock: () => this.lockForTask(),
      unlock: () => this.unlockAfterTask(),
    });

    this.noamTasks = new NoamTaskManager(this, {
      // נועם רק ב-27 – ב-30 יש את השאלה הסופית / סיום המשחק
      steps: [27],
      onTaskOpened: (_, type) => this.net?.sendTaskStarted?.(type),
      isBotPlayerIndex: (idx) => this.mode === "solo" && idx === 1,
      isLocalPlayerIndex: isLocalIdx,
      getStepWorldXY: (step) => this.getStepWorldXY(step),
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
          this.movementCtl.playPenaltyMove(playerIndex, deltaSteps, done);
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
        this.movementCtl.playPenaltyMove(playerIndex, deltaSteps, done);
      },
      onRefreshHud: () => this.refreshHUD(),
    });

    this.overlayCtl = new ParallaxOverlayController(this, {
      isMobileDevice: () => this.isMobileDevice(),
      onPortraitBlockedChange: (blocked) => {
        this.isGameBlockedForPortrait = blocked;
      },
      onBlockInput: () => {
        this.ui?.setDiceDisabled(true);
        this.ui?.setDiceVisibleDeferred(false);
      },
      onUnblockInput: () => {
        if (
          !this.tasks?.isLocked?.() &&
          !this.noamTasks?.isLocked?.() &&
          !this.taskFlow?.hasActiveSeatingTask?.()
        ) {
          this.unlockAfterTask();
        }
        this.refreshHUD();
      },
    });

    this.movementCtl = new ParallaxMovementController(
      this,
      this.players,
      this.camCtl,
      this.ui,
      this.tasks,
      this.noamTasks,
      this.taskFlow,
      {
        moveMs: this.MOVE_MS,
        getLaneStartX: () => this.laneStartX,
        getStepSizePx: () => this.stepSizePx,
        getMyIndex: () => this.getMyIndex(),
        refreshHUD: () => this.refreshHUD(),
        afterAllTasks: (playerIndex, stepsNow, done) =>
          this.handleAfterAllTasks(playerIndex, stepsNow, done),
      }
    );

    this.modeCtl = new ParallaxModeController(
      this,
      this.players,
      this.camCtl,
      this.ui,
      this.tasks,
      this.noamTasks,
      this.hudCtl,
      this.overlayCtl,
      {
        mode: this.mode,
        playerCount: this.playerCount,

        getRoom: () => this.room,
        setRoom: (room) => {
          this.room = room;
        },

        getNet: () => this.net,
        setNet: (net) => {
          this.net = net;
        },

        getSoloMatch: () => this.soloMatch,
        setSoloMatch: (match) => {
          this.soloMatch = match;
        },

        getMyPlayerIndex: () => this.myPlayerIndex,
        setMyPlayerIndex: (value) => {
          this.myPlayerIndex = value;
        },

        getCurrentTurnName: () => this.currentTurnName,
        setCurrentTurnName: (value) => {
          this.currentTurnName = value;
        },

        getNetWasReady: () => this.netWasReady,
        setNetWasReady: (value) => {
          this.netWasReady = value;
        },

        getLeavingToMenu: () => this.leavingToMenu,
        setLeavingToMenu: (value) => {
          this.leavingToMenu = value;
        },

        getLocalAvatarDataUrl: () => this.localAvatarDataUrl,
        setLocalAvatarDataUrl: (value) => {
          this.localAvatarDataUrl = value;
        },

        getWaitingSyncTimer: () => this.waitingSyncTimer,
        setWaitingSyncTimer: (value) => {
          this.waitingSyncTimer = value;
        },

        getLastRollClickTs: () => this.lastRollClickTs,

        getFixedDiceSeq: () => this.fixedDiceSeqPlayer0,
        getFixedDiceSeqIndex: () => this.fixedDiceSeqIndex0,
        setFixedDiceSeqIndex: (value) => {
          this.fixedDiceSeqIndex0 = value;
        },

        getKaliName: () => ParallaxScene.KALI_NAME,

        getMyIndex: () => this.getMyIndex(),
        getPlayerDisplayName: (playerIndex) =>
          this.getPlayerDisplayName(playerIndex),
        refreshHUD: () => this.refreshHUD(),

        playMoveTurn: (playerIndex, diceValue, onTurnFinished) =>
          this.movementCtl.playMoveTurn(playerIndex, diceValue, onTurnFinished),

        playPenaltyMove: (playerIndex, deltaSteps, done) =>
          this.movementCtl.playPenaltyMove(playerIndex, deltaSteps, done),

        lockForTask: () => this.lockForTask(),
        unlockAfterTask: () => this.unlockAfterTask(),

        onSoloBotTurnChange: (isBot) => {
          this.soloIsBotTurn = isBot;
        },

        isPortraitBlocked: () => this.isGameBlockedForPortrait,
      }
    );

    this.modeCtl.attachNetOrSolo();

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

      if (this.isGameBlockedForPortrait) return;
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

      if (this.isGameBlockedForPortrait) return;
      if (this.tasks.isLocked() || this.noamTasks.isLocked()) return;
      if (this.taskFlow.hasActiveSeatingTask()) return;

      if (this.mode === "solo") {
        this.ui.dice.playVisualRoll(value, 600);
        return;
      }

      if (this.net) {
        this.modeCtl.handleDiceRoll(value);
        return;
      }

      this.ui.dice.playVisualRoll(value, 600);
      this.movementCtl.playMoveTurn(0, value);
    });

    this.refreshHUD();
    this.overlayCtl.createRotateOverlay();
    this.overlayCtl.refreshRotateOverlay();

    this.scale.on("resize", this.handleResize, this);

    console.log("[CLIENT][ParallaxScene] create end", { ts: Date.now() });
  }

  private isMobileDevice(): boolean {
    const device = this.sys.game.device;
    return !!(device.os.android || device.os.iOS);
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
    if (this.isMobileDevice()) {
      layout.groundOffsetY = 0;
    }
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

    this.overlayCtl?.refreshRotateOverlay();
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
    const fromNet = (this.net?.getState?.() as ExtendedNetStateView | NetStateView)
      ?.names as string[] | undefined;

    if (
      fromNet &&
      fromNet[playerIndex] != null &&
      fromNet[playerIndex] !== ""
    ) {
      return fromNet[playerIndex] ?? fallback[playerIndex] ?? "שחקן";
    }

    return fallback[playerIndex] ?? "שחקן";
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

    if (this.isGameBlockedForPortrait) {
      this.ui.setDiceDisabled(true);
      this.ui.setDiceVisibleDeferred(false);
      return;
    }

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

    // לעדכן את השמות שמתחת לדמויות לפי הכינויים העדכניים (כמו שכתוב "תור של ...")
    if (this.players) {
      const names = Array.from({ length: this.playerCount }, (_, i) =>
        this.getPlayerDisplayName(i)
      );
      this.players.setPlayerNames(names);
    }
  }

  /** אחרי שכל המשימות (אמא, אבא, נועם) טופלו – בודקים אם צריך להציג את השאלה הסופית. */
  private handleAfterAllTasks(
    playerIndex: number,
    stepsNow: number,
    done: () => void
  ) {
    // אם כבר סיימנו את המשחק – לא עושים כלום
    if (this.finalQuestionCompleted) {
      done();
      return;
    }

    // רק מי שהגיע ל־30 צעדים לפחות יכול לקבל את השאלה
    if (stepsNow < 30) {
      done();
      return;
    }

    const me = this.getMyIndex();
    // במסך הזה מציגים את השאלה רק לשחקן המקומי, בשאר המסכים התור פשוט ימשיך
    if (me === null || me !== playerIndex) {
      done();
      return;
    }

    // אם כבר יש שאלה פעילה (לא אמור לקרות, אבל ליתר ביטחון)
    if (this.finalQuestionActive) {
      done();
      return;
    }

    this.openFinalQuestion(playerIndex, stepsNow, done);
  }

  /** פותח חלון שאלה סופית לשחקן שהגיע ל־30. */
  private openFinalQuestion(
    playerIndex: number,
    stepsNow: number,
    done: () => void
  ) {
    this.finalQuestionActive = true;
    this.lockForTask();

    const depth = 26000;
    const { width, height } = this.scale;

    const root = this.add
      .container(width / 2, height / 2)
      .setDepth(depth)
      .setScrollFactor(0);

    const overlay = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0.5);
    overlay.disableInteractive();

    const panelW = Math.min(760, Math.floor(width * 0.9));
    const panelH = Math.min(420, Math.floor(height * 0.9));

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.lineStyle(4, 0x111111, 0.95);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 26);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 26);

    const title = this.add
      .text(
        panelW / 2 - 30,
        -panelH / 2 + 34,
        "אנחנו כבר כמעט בחתונה\u200F!",
        {
          fontFamily: "Arial Black",
          fontSize: "24px",
          color: "#111",
          align: "right",
          rtl: true,
        }
      )
      .setOrigin(1, 0);

    const line2 = this.add
      .text(
        panelW / 2 - 30,
        -panelH / 2 + 70,
        "בשביל לעבור את השלב האחרון ולהגיע לחתונה, עני על השאלה\u200F:",
        {
          fontFamily: "Arial",
          fontSize: "18px",
          color: "#333",
          align: "right",
          rtl: true,
          wordWrap: { width: panelW - 80, useAdvancedWrap: true },
        }
      )
      .setOrigin(1, 0);

    const question = this.add
      .text(
        panelW / 2 - 30,
        -panelH / 2 + 122,
        "מה השם חיבה שנועם קורא לקלי\u200F?",
        {
          fontFamily: "Arial Black",
          fontSize: "20px",
          color: "#111",
          align: "right",
          rtl: true,
          wordWrap: { width: panelW - 80, useAdvancedWrap: true },
        }
      )
      .setOrigin(1, 0);

    const timerText = this.add
      .text(-panelW / 2 + 24, -panelH / 2 + 20, "⏳ 01:00", {
        fontFamily: "Arial Black",
        fontSize: "20px",
        color: "#d90429",
      })
      .setOrigin(0, 0);

    const device = this.sys.game.device;
    const isMobile = device.os.android || device.os.iOS;
    const viewport: any = (window as any).visualViewport || window;
    const vw = viewport.width;
    const vh = viewport.height;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "כתבי כאן את שם החיבה...";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.dir = "rtl";
    input.style.position = "fixed";
    input.style.left = `${vw / 2}px`;
    const centerY = isMobile ? vh * 0.6 : vh * 0.6;
    input.style.top = `${centerY}px`;
    input.style.transform = "translate(-50%, -50%)";
    input.style.width = `min(94vw, ${Math.min(720, vw - 48)}px)`;
    input.style.height = "58px";
    input.style.padding = "0 20px";
    input.style.fontSize = "24px";
    input.style.borderRadius = "14px";
    input.style.border = "2px solid #111";
    input.style.zIndex = "999999";
    input.style.background = "#ffffff";
    input.style.color = "#111111";

    // במסך מלא רק ילדים של fullscreenElement מוצגים, לכן מוסיפים לשם אם יש.
    const fullscreenHost = document.fullscreenElement as HTMLElement | null;
    const host = fullscreenHost ?? document.body;
    host.appendChild(input);

    const cleanupHtmlInput = () => {
      input.remove();
    };

    let remaining = 60;
    const renderTimer = () => {
      const mm = Math.floor(remaining / 60)
        .toString()
        .padStart(2, "0");
      const ss = (remaining % 60).toString().padStart(2, "0");
      timerText.setText(`⏳ ${mm}:${ss}`);
    };
    renderTimer();

    const timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        remaining -= 1;
        renderTimer();
        if (remaining <= 0) {
          timerEvent.remove(false);
          failAndClose("נגמר הזמן לשאלה...");
        }
      },
    });

    const normalize = (raw: string) =>
      raw
        .trim()
        .replace(/["'״׳]/g, "")
        .toLowerCase();

    const correctAnswers = new Set([
      "לרזוש",
      "לרזושה",
      "לרזושונת",
    ]);

    const finishAll = () => {
      this.finalQuestionActive = false;
      this.unlockAfterTask();
      root.destroy(true);
      cleanupHtmlInput();
      done();
    };

    const winAndCelebrate = () => {
      this.finalQuestionCompleted = true;
      timerEvent.remove(false);
      cleanupHtmlInput();
      root.destroy(true);

      this.startFinalCelebration(playerIndex);
    };

    const failAndClose = (message: string) => {
      this.hudCtl.showSmallStatus(message);
      timerEvent.remove(false);
      finishAll();
    };

    input.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") {
        ev.preventDefault();
        const norm = normalize(input.value);
        if (correctAnswers.has(norm)) {
          winAndCelebrate();
        } else {
          failAndClose("התשובה לא נכונה... נסי שוב כשתגיעי שוב לסוף הדרך.");
        }
      }
    });

    window.setTimeout(() => {
      input.focus();
    }, 30);

    root.add([overlay, bg, title, line2, question, timerText]);
  }

  /** אפקט סיום – קונפטי ו״חתולים״ מתעופפים באוויר, ואז חזרה לתפריט. */
  private startFinalCelebration(playerIndex: number) {
    this.lockForTask();
    const winnerName = this.getPlayerDisplayName(playerIndex);

    const { width, height } = this.scale;
    const depth = 30000;

    const root = this.add
      .container(width / 2, height / 2)
      .setDepth(depth)
      .setScrollFactor(0);

    const overlay = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.8)
      .setOrigin(0.5);
    overlay.disableInteractive();

    const title = this.add
      .text(0, -height * 0.18, "החתונה יצאה לדרך!", {
        fontFamily: "Arial Black",
        fontSize: "40px",
        color: "#ffe066",
        align: "center",
      })
      .setOrigin(0.5);

    const winnerLine = this.add
      .text(0, -height * 0.06, `${winnerName} – אלופה של החתונה!`, {
        fontFamily: "Arial Black",
        fontSize: "30px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(
        0,
        height * 0.08,
        "קונפטי, זיקוקים וחתולים מעופפים חוגגים את הניצחון שלך!",
        {
          fontFamily: "Arial",
          fontSize: "20px",
          color: "#ffeeff",
          align: "center",
          wordWrap: { width: width * 0.8, useAdvancedWrap: true },
        }
      )
      .setOrigin(0.5);

    root.add([overlay, title, winnerLine, sub]);

    // "חתולים" מתעופפים (טקסט אמוג'י) מכל הכיוונים
    const cats: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(-width / 2, width / 2);
      const y = Phaser.Math.Between(height / 2, height / 2 + 120);
      const cat = this.add
        .text(x, y, "😺", {
          fontFamily: "Arial",
          fontSize: "36px",
        })
        .setOrigin(0.5);
      root.add(cat);
      cats.push(cat);

      this.tweens.add({
        targets: cat,
        y: y - Phaser.Math.Between(height * 0.6, height * 0.9),
        x: x + Phaser.Math.Between(-120, 120),
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(2500, 4200),
        ease: "Sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }

    // קונפטי צבעוני פשוט (מלבנים קטנים)
    const confetti: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 180; i++) {
      const x = Phaser.Math.Between(-width / 2, width / 2);
      const y = Phaser.Math.Between(-height / 2, height / 2);
      const rect = this.add
        .rectangle(x, y, 6, 14, Phaser.Display.Color.RandomRGB().color)
        .setOrigin(0.5);
      root.add(rect);
      confetti.push(rect);

      this.tweens.add({
        targets: rect,
        y: height / 2 + 80,
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(2200, 3800),
        ease: "Cubic.in",
        repeat: -1,
        delay: Phaser.Math.Between(0, 1200),
      });
    }

    // אחרי כמה שניות – חזרה חגיגית לתפריט
    this.time.delayedCall(9000, () => {
      this.leavingToMenu = true;
      this.scene.start("menu-scene");
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

    this.registry.remove("room");
    this.registry.remove("net");

    this.scale.off("resize", this.handleResize, this);

    this.modeCtl?.destroy();
    this.taskFlow?.destroy();

    this.tasks?.destroy();
    this.noamTasks?.destroy();

    this.overlayCtl?.destroy();

    this.world?.destroy();
    this.players?.destroy();
    this.momCtl?.destroy();
    this.ui?.destroy();
  }

  update() {
    if (this.isGameBlockedForPortrait) {
      return;
    }

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

/** מוגדר כאן (באותו קובץ) כדי שבדיפלוי הבандלר לא יגרום ל־"is not a constructor". */
type MovementControllerOpts = {
  moveMs: number;
  getLaneStartX: () => number;
  getStepSizePx: () => number;
  getMyIndex: () => number | null;
  refreshHUD: () => void;
  afterAllTasks: (
    playerIndex: number,
    stepsNow: number,
    done: () => void
  ) => void;
};

class ParallaxMovementController {
  constructor(
    private scene: Phaser.Scene,
    private players: PlayerManager,
    private camCtl: CameraController,
    private ui: SceneUI,
    private tasks: TaskManager,
    private noamTasks: NoamTaskManager,
    private taskFlow: ParallaxTaskFlowController,
    private opts: MovementControllerOpts
  ) {}

  playMoveTurn(
    playerIndex: number,
    diceValue: number,
    onTurnFinished?: () => void
  ) {
    this.ui.setLastRoll(diceValue);
    this.ui.setMoving(true);

    this.players.moveByDice({
      playerIndex,
      diceValue,
      laneStartX: this.opts.getLaneStartX(),
      stepSizePx: this.opts.getStepSizePx(),
      maxX: this.camCtl.getMaxXPadding(40),
      duration: this.opts.moveMs,
      onComplete: () => {
        this.ui.setMoving(false);

        const stepsNow = this.players.getSteps(playerIndex);

        this.tasks.handleAfterMove(playerIndex, stepsNow, () => {
          this.taskFlow.handleWeddingSeatingAfterMove(
            playerIndex,
            stepsNow,
            () => {
              this.noamTasks.handleAfterMove(playerIndex, stepsNow, () => {
                const finalSteps = this.players.getSteps(playerIndex);

                this.opts.afterAllTasks(playerIndex, finalSteps, () => {
                  const followIdx = this.opts.getMyIndex() ?? 0;

                  this.opts.refreshHUD();

                  this.scene.time.delayedCall(100, () => {
                    this.camCtl.follow(this.players.getContainer(followIdx));
                  });

                  this.ui.flushPendingDiceVisibility();
                  onTurnFinished?.();
                });
              });
            }
          );
        });
      },
    });
  }

  playPenaltyMove(
    playerIndex: number,
    deltaSteps: number,
    done?: () => void
  ) {
    this.ui.setMoving(true);

    this.players.moveByDice({
      playerIndex,
      diceValue: deltaSteps,
      laneStartX: this.opts.getLaneStartX(),
      stepSizePx: this.opts.getStepSizePx(),
      maxX: this.camCtl.getMaxXPadding(40),
      duration: 1300,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.ui.setMoving(false);

        const followIdx = this.opts.getMyIndex() ?? 0;

        this.scene.time.delayedCall(80, () => {
          this.camCtl.follow(this.players.getContainer(followIdx));
        });

        this.opts.refreshHUD();
        done?.();
      },
    });
  }
}