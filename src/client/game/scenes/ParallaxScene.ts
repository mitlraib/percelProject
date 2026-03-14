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
import ParallaxMovementController from "./parallax/ParallaxMovementController";
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

  private readonly fixedDiceSeqPlayer0 = [5, 2, 3, 5, 6, 6];
  private fixedDiceSeqIndex0 = 0;
  private static readonly KALI_NAME = "קלי";

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
      steps: [27, 30],
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

      if (this.mode === "solo") return;

      if (this.net) {
        this.modeCtl.handleDiceRoll(value);
        return;
      }

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