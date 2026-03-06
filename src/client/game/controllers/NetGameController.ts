// src/client/game/controllers/NetGameController.ts
import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";

export type NetStateView = {
  ready: boolean;
  myIndex: number | null;
  currentTurn: number;
  canRollNow: boolean;
};

type PlayersPayload = { count: number; players: string[] };
type ReadyPayload = { ok: boolean };
type AssignPayload = { playerIndex: number };
type TurnPayload = { currentTurn: number };
type MovePayload = { playerIndex: number; value: number };
type PenaltyMovePayload = { playerIndex: number; deltaSteps: number };
type RollDeniedPayload = { reason?: string; currentTurn?: number };

export default class NetGameController extends Phaser.Events.EventEmitter {
  private room: Room;
  private playerCount: number;

  private playersCount = 0;
  private ready = false;

  private myIndex: number | null = null;
  private currentTurn = -1;

  private canRollNowFlag = false;

  constructor(room: Room, playerCount: number) {
    super();
    this.room = room;
    this.playerCount = playerCount;

    room.onMessage("players", (p: PlayersPayload) => {
      this.playersCount = p.count;
      this.recomputeCanRoll();
      this.emitState();
    });

    room.onMessage("ready", (p: ReadyPayload) => {
      this.ready = !!p.ok;
      this.recomputeCanRoll();
      this.emitState();
    });

    room.onMessage("assign", (p: AssignPayload) => {
      this.myIndex = Number.isFinite(p.playerIndex) ? p.playerIndex : null;
      this.recomputeCanRoll();
      this.emitState();
    });

    room.onMessage("turn", (p: TurnPayload) => {
      this.currentTurn = Number.isFinite(p.currentTurn) ? p.currentTurn : -1;
      this.recomputeCanRoll();
      this.emitState();
    });

    room.onMessage("move", (p: MovePayload) => {
      this.emit("move", p);
    });

    room.onMessage("penaltyMove", (p: PenaltyMovePayload) => {
      this.emit("penaltyMove", p);
    });

    room.onMessage("rollDenied", (p: RollDeniedPayload) => {
      if (Number.isFinite(p.currentTurn)) {
        this.currentTurn = p.currentTurn as number;
        this.recomputeCanRoll();
        this.emitState();
      }
      this.room.send("sync");
      this.emit("rollDenied", p);
    });

    this.room.send("sync");
  }

  destroy() {
    this.removeAllListeners();
  }

  canRollNow() {
    return this.canRollNowFlag;
  }

  sendRoll(value: number) {
    this.room.send("roll", { value });
  }

  // ✅ Noam penalty
  // optional: include myIndex to help server debugging (server can ignore)
  sendPenalty(deltaSteps: number) {
    this.room.send("penalty", { deltaSteps, playerIndex: this.myIndex });
  }

  private recomputeCanRoll() {
    this.canRollNowFlag =
      this.ready &&
      this.myIndex !== null &&
      this.currentTurn >= 0 &&
      this.myIndex === this.currentTurn;
  }

  private emitState() {
    const s: NetStateView = {
      ready: this.ready,
      myIndex: this.myIndex,
      currentTurn: this.currentTurn,
      canRollNow: this.canRollNowFlag,
    };
    this.emit("state", s);
  }
}