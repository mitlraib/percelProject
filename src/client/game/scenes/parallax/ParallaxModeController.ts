import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";

import NetGameController, {
  type NetStateView,
} from "../../controllers/NetGameController";
import SoloVsBotMatch from "../../match/SoloVsBotMatch";
import type { ExtendedNetStateView, Mode } from "./ParallaxTypes";
import type PlayerManager from "../../controllers/PlayerManager";
import type CameraController from "../../controllers/CameraController";
import type SceneUI from "../../controllers/SceneUI";
import type TaskManager from "../../controllers/TaskManager";
import type NoamTaskManager from "../../controllers/NoamTaskManager";
import type ParallaxHudController from "./ParallaxHudController";
import type ParallaxOverlayController from "./ParallaxOverlayController";
import { REGISTRY_DISPLAY_NAME, REGISTRY_AVATAR_DATA_URL } from "../PlayerSetupScene";

type ModeControllerOpts = {
  mode: Mode;
  playerCount: number;

  getRoom: () => Room | undefined;
  setRoom: (room?: Room) => void;

  getNet: () => NetGameController | undefined;
  setNet: (net?: NetGameController) => void;

  getSoloMatch: () => SoloVsBotMatch | undefined;
  setSoloMatch: (match?: SoloVsBotMatch) => void;

  getMyPlayerIndex: () => number | null;
  setMyPlayerIndex: (value: number | null) => void;

  getCurrentTurnName: () => string;
  setCurrentTurnName: (value: string) => void;

  getNetWasReady: () => boolean;
  setNetWasReady: (value: boolean) => void;

  getLeavingToMenu: () => boolean;
  setLeavingToMenu: (value: boolean) => void;

  getLocalAvatarDataUrl: () => string | null;
  setLocalAvatarDataUrl: (value: string | null) => void;

  getWaitingSyncTimer: () => Phaser.Time.TimerEvent | null;
  setWaitingSyncTimer: (value: Phaser.Time.TimerEvent | null) => void;

  getLastRollClickTs: () => number | null;

  getFixedDiceSeq: () => number[];
  getFixedDiceSeqIndex: () => number;
  setFixedDiceSeqIndex: (value: number) => void;

  getKaliName: () => string;

  getMyIndex: () => number | null;
  getPlayerDisplayName: (playerIndex: number) => string;
  refreshHUD: () => void;

  playMoveTurn: (
    playerIndex: number,
    diceValue: number,
    onTurnFinished?: () => void
  ) => void;

  playPenaltyMove: (
    playerIndex: number,
    deltaSteps: number,
    done?: () => void
  ) => void;

  lockForTask: () => void;
  unlockAfterTask: () => void;

  onSoloBotTurnChange: (isBot: boolean) => void;

  isPortraitBlocked: () => boolean;
};

export default class ParallaxModeController {
  private scene: Phaser.Scene;
  private players: PlayerManager;
  private camCtl: CameraController;
  private ui: SceneUI;
  private tasks: TaskManager;
  private noamTasks: NoamTaskManager;
  private hudCtl: ParallaxHudController;
  private overlayCtl: ParallaxOverlayController;
  private opts: ModeControllerOpts;

  constructor(
    scene: Phaser.Scene,
    players: PlayerManager,
    camCtl: CameraController,
    ui: SceneUI,
    tasks: TaskManager,
    noamTasks: NoamTaskManager,
    hudCtl: ParallaxHudController,
    overlayCtl: ParallaxOverlayController,
    opts: ModeControllerOpts
  ) {
    this.scene = scene;
    this.players = players;
    this.camCtl = camCtl;
    this.ui = ui;
    this.tasks = tasks;
    this.noamTasks = noamTasks;
    this.hudCtl = hudCtl;
    this.overlayCtl = overlayCtl;
    this.opts = opts;
  }

  attachNetOrSolo() {
    if (this.opts.mode === "solo") {
      this.attachSolo();
      return;
    }

    if (this.opts.playerCount === 1) {
      this.opts.setCurrentTurnName("תור שלך");
      return;
    }

    const room = this.scene.registry.get("room") as Room | undefined;
    const existingNet = this.scene.registry.get("net") as NetGameController | undefined;

    if (!room) {
      this.scene.game.events.once("room-ready", () => {
        const r = this.scene.registry.get("room") as Room | undefined;
        const net = this.scene.registry.get("net") as NetGameController | undefined;
        if (r) this.attachNet(r, net);
      });
      return;
    }

    this.attachNet(room, existingNet);
  }

  private attachSolo() {
    const soloMatch = new SoloVsBotMatch(this.scene, this.ui.dice as never, {
      name: "מיטול",
      emoji: "👰‍♀️",
    });

    this.opts.setSoloMatch(soloMatch);

    soloMatch.on("turn-changed", (e: { player: { isBot: boolean; name: string } }) => {
      this.opts.onSoloBotTurnChange(e.player.isBot);
      this.opts.setCurrentTurnName(e.player.name);

      this.ui.setDiceVisibleDeferred(!e.player.isBot);
      this.ui.setDiceDisabled(e.player.isBot);

      this.opts.refreshHUD();
    });

    soloMatch.on("dice-rolled", (e: { player: { name: string }; value: number }) => {
      const idx = e.player.name === "מיטול" ? 0 : 1;
      this.opts.playMoveTurn(idx, e.value, () => soloMatch.advanceTurn());
    });

    soloMatch.start();
  }

  private attachNet(room: Room, existingNet?: NetGameController) {
    this.opts.setRoom(room);

    const net = existingNet ?? new NetGameController(room, this.opts.playerCount);
    this.opts.setNet(net);

    const displayName = this.scene.registry.get(REGISTRY_DISPLAY_NAME) as string | undefined;
    const avatarDataUrl = this.scene.registry.get(REGISTRY_AVATAR_DATA_URL) as string | undefined;

    this.opts.setLocalAvatarDataUrl(avatarDataUrl ?? null);

    if (displayName || avatarDataUrl) {
      net.sendPlayerMeta(displayName, avatarDataUrl);
    }

    const applyNetState = (rawState: NetStateView) => {
      const s = rawState as ExtendedNetStateView;

      if (!s.ready) {
        this.handleNotReadyState(s);
        return;
      }

      this.handleReadyState(s);
    };

    net.on("state", applyNetState);
    applyNetState(net.getState());

    this.scene.time.delayedCall(400, () => {
      net.requestSync?.();
    });

    net.on("move", ({ playerIndex, value }: { playerIndex: number; value: number }) => {
      this.opts.playMoveTurn(playerIndex, value);
    });

    net.on(
      "penaltyMove",
      ({ playerIndex, deltaSteps }: { playerIndex: number; deltaSteps: number }) => {
        this.opts.playPenaltyMove(playerIndex, deltaSteps);
      }
    );

    net.on(
      "taskStarted",
      ({ type, playerIndex }: { type: "mom" | "noam" | "dad"; playerIndex: number }) => {
        const me = this.opts.getMyIndex();
        if (me !== null && playerIndex === me) return;

        const name = this.opts.getPlayerDisplayName(playerIndex);
        this.overlayCtl.showTaskStarted(type, name);
      }
    );
  }

  handleDiceRoll(value: number) {
    if (this.opts.mode === "solo") return;

    let finalValue = value;
    const meIdx = this.opts.getMyIndex();
    const currentTurn = this.opts.getNet()?.getState().currentTurn ?? -1;

    const isKaliTurn =
      meIdx !== null &&
      meIdx === currentTurn &&
      this.opts.getPlayerDisplayName(meIdx).trim() === this.opts.getKaliName();

    if (isKaliTurn) {
      const seq = this.opts.getFixedDiceSeq();
      const idx = this.opts.getFixedDiceSeqIndex();
      if (idx < seq.length) {
        finalValue = seq[idx];
        this.opts.setFixedDiceSeqIndex(idx + 1);
      }
    }

    const net = this.opts.getNet();
    if (!net) return;
    if (this.opts.getMyIndex() === null) return;
    if (!net.canRollNow()) return;

    this.ui.dice.playVisualRoll(finalValue, 600);
    this.ui.setDiceVisibleDeferred(true);

    net.sendRoll(finalValue);
  }

  destroy() {
    this.opts.getNet()?.destroy();
    this.opts.setNet(undefined);

    this.opts.getSoloMatch()?.destroy();
    this.opts.setSoloMatch(undefined);
  }

  private handleNotReadyState(s: ExtendedNetStateView) {
    if (this.opts.getNetWasReady()) {
      this.ui.setDicePlayer("מחכה לשחקניות…", "⏳");
      this.ui.setDiceDisabled(true);
      this.ui.setDiceVisibleDeferred(false);
      this.opts.setCurrentTurnName("שחקנית התנתקה – חוזרים לתפריט");
      this.opts.refreshHUD();

      if (!this.opts.getLeavingToMenu()) {
        this.opts.setLeavingToMenu(true);

        this.scene.time.delayedCall(1800, () => {
          try {
            this.opts.getRoom()?.leave();
          } catch {}

          this.scene.registry.remove("room");
          this.scene.registry.remove("net");
          this.scene.scene.start("menu-scene");
        });
      }

      return;
    }

    this.ui.setDicePlayer("מחכה לשחקנים…", "⏳");
    this.ui.setDiceDisabled(true);
    this.ui.setDiceVisibleDeferred(false);
    this.opts.setCurrentTurnName("מחכה לשחקנים…");
    this.opts.refreshHUD();

    if (!this.opts.getWaitingSyncTimer()) {
      const net = this.opts.getNet();
      if (!net) return;

      const timer = this.scene.time.addEvent({
        delay: 1500,
        callback: () => net.requestSync?.(),
        loop: true,
      });

      this.opts.setWaitingSyncTimer(timer);
    }
  }

  private handleReadyState(s: ExtendedNetStateView) {
    const waitingTimer = this.opts.getWaitingSyncTimer();
    if (waitingTimer) {
      waitingTimer.destroy();
      this.opts.setWaitingSyncTimer(null);
    }

    this.opts.setNetWasReady(true);

    if (s.myIndex !== null && s.myIndex !== undefined) {
      this.opts.setMyPlayerIndex(s.myIndex);
    }

    const fallbackNames = this.hudCtl.getCharNames(
      this.opts.mode,
      this.opts.playerCount,
      this.opts.getMyPlayerIndex()
    );

    const names =
      s.names && s.names.length
        ? s.names.map((n, i) => n ?? fallbackNames[i] ?? "שחקן")
        : fallbackNames;

    // נעדכן גם את השמות שמופיעים מתחת לדמויות בלוח
    this.players.setPlayerNames(names);

    const emojis = ["👧", "🐶", "🐻", "🎮"];
    const me = this.opts.getMyIndex();

    try {
      const avatars = s.avatars ?? [];

      avatars.forEach((dataUrl, idx) => {
        if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
          return;
        }

        const key = `player-avatar-${idx}`;

        if (!this.scene.textures.exists(key)) {
          this.scene.textures.once("addtexture", (texKey: string) => {
            if (texKey === key) {
              this.players.setPlayerTexture(idx, key);
            }
          });
          this.scene.textures.addBase64(key, dataUrl);
        } else {
          this.players.setPlayerTexture(idx, key);
        }
      });

      const localAvatarDataUrl = this.opts.getLocalAvatarDataUrl();

      if (
        me !== null &&
        localAvatarDataUrl &&
        (!s.avatars || !s.avatars[me]) &&
        localAvatarDataUrl.startsWith("data:image")
      ) {
        const localKey = `player-local-avatar-${me}`;

        if (!this.scene.textures.exists(localKey)) {
          this.scene.textures.once("addtexture", (texKey: string) => {
            if (texKey === localKey) {
              this.players.setPlayerTexture(me, localKey);
            }
          });
          this.scene.textures.addBase64(localKey, localAvatarDataUrl);
        } else {
          this.players.setPlayerTexture(me, localKey);
        }
      }

      if (this.scene.textures.exists("KALI")) {
        names.forEach((n, idx) => {
          if (typeof n === "string" && n.trim() === "קלי") {
            this.players.setPlayerTexture(idx, "KALI");
          }
        });
      }
    } catch {}

    const myIdxForUI = me ?? 0;
    const myName = names[myIdxForUI] ?? "שחקן";
    const myEmoji = emojis[myIdxForUI] ?? "🎮";

    this.ui.setDicePlayer(myName, myEmoji);

    if (me === null) {
      this.ui.setDiceDisabled(true);
      this.ui.setDiceVisibleDeferred(false);
    } else if (!this.tasks.isLocked() && !this.noamTasks.isLocked()) {
      this.ui.setDiceDisabled(!s.canRollNow);
      this.ui.setDiceVisibleDeferred(s.canRollNow);
    }

    this.opts.setCurrentTurnName(names[s.currentTurn] ?? "");
    this.opts.refreshHUD();

    if (me !== null) {
      this.camCtl.follow(this.players.getContainer(me));
    }

    if (this.opts.isPortraitBlocked()) {
      this.ui.setDiceDisabled(true);
      this.ui.setDiceVisibleDeferred(false);
    }
  }
}