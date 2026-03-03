//src\client\game\controllers\DuoNetController.ts
// מחלקה זו אחראית על כל התקשורת מול קוליסיוס במצב 2 שחקנים:


import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";

type TurnMsg = { currentTurn: number };
type AssignMsg = { playerIndex: number };
type MoveMsg = { playerIndex: number; value: number };
type ReadyMsg = { ok?: boolean };

export type DuoState = {
  duoReady: boolean;
  myPlayerIndex: number | null;
  currentTurn: number;
  rollLocked: boolean;
  canRollNow: boolean;
};

export default class DuoNetController extends Phaser.Events.EventEmitter {
  private room: Room;

  public myPlayerIndex: number | null = null;
  public duoReady = false;
  public currentTurn = -1;

  public rollLocked = false;

  private stuckTimer?: number;
  private readonly STUCK_MS = 2000;

  constructor(room: Room) {
    super();
    this.room = room;

    this.bindRoomLifecycle();
    this.bindMessages();

    this.safeSend("sync", {});
  }

  destroy() {
    this.clearStuckTimer();
    this.removeAllListeners();
  }

  getState(): DuoState {
    return {
      duoReady: this.duoReady,
      myPlayerIndex: this.myPlayerIndex,
      currentTurn: this.currentTurn,
      rollLocked: this.rollLocked,
      canRollNow: this.canRollNow(),
    };
  }

  canRollNow() {
    if (!this.duoReady) return false;
    if (this.myPlayerIndex === null) return false;
    if (this.currentTurn < 0) return false;
    if (this.rollLocked) return false;
    return this.currentTurn === this.myPlayerIndex;
  }

  sendRoll(value: number) {
    console.log("sendRoll click ←", {
      value,
      can: this.canRollNow(),
      locked: this.rollLocked,
      turn: this.currentTurn,
      me: this.myPlayerIndex,
      ready: this.duoReady,
    });

    if (!this.canRollNow()) return;

    this.lock("sendRoll");
    this.startStuckTimer();

    this.safeSend("roll", { value });
  }

  forceSync() {
    console.warn("forceSync ←");
    this.unlock("forceSync");
    this.safeSend("sync", {});
  }

  // ---------------- private ----------------

  private bindRoomLifecycle() {
    this.room.onError((code, message) => {
      console.error("room error ←", code, message);
      this.unlock("onError");
      this.emitState();
    });

    this.room.onLeave((code) => {
      console.warn("room leave ←", code);
      this.unlock("onLeave");
      this.duoReady = false;
      this.currentTurn = -1;
      this.emitState();
    });
  }

  private bindMessages() {
    // ✅ תוספת: כדי להעלים אזהרה
    this.room.onMessage("players", (msg: any) => {
      console.log("net msg ← players", msg);
    });

    this.room.onMessage("ready", (msg: ReadyMsg) => {
      console.log("net msg ← ready", msg);
      this.duoReady = !!msg?.ok;

      if (!this.duoReady) {
        this.currentTurn = -1;
        this.unlock("ready=false");
      }

      this.emitState();
    });

    this.room.onMessage("assign", (msg: AssignMsg) => {
      console.log("net msg ← assign", msg);
      const idx = Number(msg?.playerIndex);
      if (!Number.isFinite(idx)) return;

      this.myPlayerIndex = idx;
      this.emitState();
    });

    this.room.onMessage("turn", (msg: TurnMsg) => {
      console.log("net msg ← turn", msg);
      const t = Number(msg?.currentTurn);
      if (!Number.isFinite(t)) return;

      this.currentTurn = t;

      this.unlock("turn");
      this.emitState();
    });

    this.room.onMessage("move", (msg: MoveMsg) => {
      console.log("net msg ← move", msg);
      const p = Number(msg?.playerIndex);
      const v = Number(msg?.value);
      if (!Number.isFinite(p) || !Number.isFinite(v)) return;

      this.unlock("move");

      this.emit("move", { playerIndex: p, value: v });
      this.emitState();
    });

    const denyNames = ["rollDenied", "roll_denied", "roll-denied", "denied"] as const;
    denyNames.forEach((name) => {
      this.room.onMessage(name, (msg: any) => {
        console.log(`net msg ← ${name}`, msg);
        this.unlock(name);
        this.emitState();
      });
    });

    this.room.onMessage("sync", (msg: any) => {
      console.log("net msg ← sync", msg);

      const t = Number(msg?.currentTurn);
      if (Number.isFinite(t)) this.currentTurn = t;

      const ready = msg?.ok ?? msg?.duoReady;
      if (typeof ready === "boolean") this.duoReady = ready;

      this.unlock("sync");
      this.emitState();
    });
  }

  private emitState() {
    this.emit("state", this.getState());
  }

  private lock(reason: string) {
    this.rollLocked = true;
    console.log("lock ←", reason);
    this.emitState();
  }

  private unlock(reason: string) {
    if (this.rollLocked) {
      console.log("unlock ←", reason);
    }
    this.rollLocked = false;
    this.clearStuckTimer();
  }

  private startStuckTimer() {
    this.clearStuckTimer();

    this.stuckTimer = window.setTimeout(() => {
      if (!this.rollLocked) return;

      console.warn("roll stuck ← force unlock + sync");
      this.unlock("watchdog");
      this.emitState();

      this.safeSend("sync", {});
    }, this.STUCK_MS);
  }

  private clearStuckTimer() {
    if (this.stuckTimer !== undefined) {
      window.clearTimeout(this.stuckTimer);
      this.stuckTimer = undefined;
    }
  }

  private safeSend(type: string, payload: any) {
    try {
      this.room.send(type as any, payload);
    } catch (e) {
      console.error("room.send failed ←", type, e);
      this.unlock("send failed");
      this.emitState();
    }
  }
}