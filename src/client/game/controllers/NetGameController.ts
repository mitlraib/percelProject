import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";

export type NetStateView = {
  ready: boolean;
  myIndex: number | null;
  currentTurn: number;
  canRollNow: boolean;
  names?: (string | null)[];
  avatars?: (string | null)[];
};

type PlayersPayload = { count: number; players: string[] };
type ReadyPayload = { ok: boolean };
type AssignPayload = { playerIndex: number };
type TurnPayload = { currentTurn: number };
type MovePayload = { playerIndex: number; value: number };
type PenaltyMovePayload = { playerIndex: number; deltaSteps: number };
type RollDeniedPayload = { reason?: string; currentTurn?: number };
type PlayersMetaPayload = { names?: (string | null)[]; avatars?: (string | null)[] };
type TaskType = "mom" | "noam" | "dad";
type TaskStartedPayload = { type: TaskType; playerIndex: number };

export default class NetGameController extends Phaser.Events.EventEmitter {
  private room: Room;
  private playerCount: number;

  private playersCount = 0;
  private ready = false;

  private myIndex: number | null = null;
  private currentTurn = -1;

  private canRollNowFlag = false;
  private names: (string | null)[] = [];
  private avatars: (string | null)[] = [];

  constructor(room: Room, playerCount: number) {
    super();
    this.room = room;
    this.playerCount = playerCount;

    console.log("[CLIENT][NetGameController] ctor", {
      ts: Date.now(),
      playerCount,
    });

    this.room.onLeave((code) => {
      console.log("[CLIENT] room.onLeave", {
        code,
        roomId: (this.room as any)?.roomId,
        sessionId: (this.room as any)?.sessionId,
        ts: Date.now(),
      });
    });

    this.room.onError((code, message) => {
      console.log("[CLIENT] room.onError", {
        code,
        message,
        roomId: (this.room as any)?.roomId,
        sessionId: (this.room as any)?.sessionId,
        ts: Date.now(),
      });
    });

    room.onMessage("players", (p: PlayersPayload) => {
      this.playersCount = p.count;
      this.recomputeCanRoll();

      console.log("[CLIENT] players from server", {
        count: p.count,
        players: p.players,
        myIndex: this.myIndex,
        currentTurn: this.currentTurn,
        canRollNow: this.canRollNowFlag,
        ts: Date.now(),
      });

      this.emitState();
    });

    room.onMessage("ready", (p: ReadyPayload) => {
      this.ready = !!p.ok;
      this.recomputeCanRoll();

      console.log("[CLIENT] ready from server", {
        ready: this.ready,
        myIndex: this.myIndex,
        currentTurn: this.currentTurn,
        canRollNow: this.canRollNowFlag,
        ts: Date.now(),
      });

      this.emitState();
    });

    room.onMessage("assign", (p: AssignPayload) => {
      this.myIndex = Number.isFinite(p.playerIndex) ? p.playerIndex : null;
      this.recomputeCanRoll();

      console.log("[CLIENT] assign from server", {
        myIndex: this.myIndex,
        currentTurn: this.currentTurn,
        ready: this.ready,
        canRollNow: this.canRollNowFlag,
        ts: Date.now(),
      });

      this.emitState();
    });

    room.onMessage("turn", (p: TurnPayload) => {
      this.currentTurn = Number.isFinite(p.currentTurn) ? p.currentTurn : -1;
      this.recomputeCanRoll();

      console.log("[CLIENT] turn from server", {
        currentTurn: this.currentTurn,
        myIndex: this.myIndex,
        ready: this.ready,
        canRollNow: this.canRollNowFlag,
        ts: Date.now(),
      });

      this.emitState();
    });

    room.onMessage("move", (p: MovePayload) => {
      console.log("[CLIENT] move from server", {
        playerIndex: p.playerIndex,
        value: p.value,
        ts: Date.now(),
      });
      this.emit("move", p);
    });

    room.onMessage("penaltyMove", (p: PenaltyMovePayload) => {
      console.log("[CLIENT] penaltyMove from server", {
        playerIndex: p.playerIndex,
        deltaSteps: p.deltaSteps,
        ts: Date.now(),
      });
      this.emit("penaltyMove", p);
    });

    room.onMessage("playersMeta", (p: PlayersMetaPayload) => {
      this.names = p.names ?? [];
      this.avatars = p.avatars ?? [];

      console.log("[CLIENT] playersMeta from server", {
        names: this.names,
        avatarLengths: this.avatars.map((a) => (a ? a.length : null)),
        ts: Date.now(),
      });

      this.emitState();
    });

    room.onMessage("rollDenied", (p: RollDeniedPayload) => {
      if (Number.isFinite(p.currentTurn)) {
        this.currentTurn = p.currentTurn as number;
        this.recomputeCanRoll();
        this.emitState();
      }

      console.log("[CLIENT] rollDenied from server", {
        reason: p.reason,
        currentTurn: p.currentTurn,
        myIndex: this.myIndex,
        canRollNow: this.canRollNowFlag,
        ts: Date.now(),
      });

      this.emit("rollDenied", p);
    });

    room.onMessage("taskStarted", (p: TaskStartedPayload) => {
      console.log("[CLIENT] taskStarted from server", {
        type: p.type,
        playerIndex: p.playerIndex,
        ts: Date.now(),
      });
      this.emit("taskStarted", p);
    });

    console.log("[CLIENT] sending initial sync", { ts: Date.now() });
    this.room.send("sync");
  }

  destroy() {
    this.removeAllListeners();
  }

  canRollNow() {
    return this.canRollNowFlag;
  }

  sendRoll(value: number) {
    console.log("[CLIENT] sendRoll", {
      value,
      myIndex: this.myIndex,
      currentTurn: this.currentTurn,
      canRollNow: this.canRollNowFlag,
      ts: Date.now(),
    });
    this.room.send("roll", { value });
  }

  sendPenalty(deltaSteps: number) {
    console.log("[CLIENT] sendPenalty", {
      deltaSteps,
      myIndex: this.myIndex,
      ts: Date.now(),
    });
    this.room.send("penalty", { deltaSteps, playerIndex: this.myIndex });
  }

  sendPlayerMeta(name?: string, avatar?: string) {
    // נשלח לשרת שם + תמונה דחוסה, עם הגנה על גודל
    let safeAvatar = avatar;

    // אם התמונה עדיין גדולה מדי (dataURL ארוך), לא נשלח אותה בכלל כדי לא לשבור את החיבור
    const MAX_AVATAR_CHARS = 50_000;
    if (safeAvatar && safeAvatar.length > MAX_AVATAR_CHARS) {
      console.warn("[CLIENT] avatar too large, skipping send to server", {
        length: safeAvatar.length,
        max: MAX_AVATAR_CHARS,
      });
      safeAvatar = undefined;
    }

    console.log("[CLIENT] sendPlayerMeta", {
      name,
      hasAvatar: !!safeAvatar,
      avatarLength: safeAvatar?.length ?? null,
      ts: Date.now(),
    });

    this.room.send("playerMeta", { name, avatar: safeAvatar });

    // אחרי עדכון שם/תמונה, נבקש גם סנכרון מלא מהשרת
    // כדי לוודא שהסטייט (ready / turn וכו') מתיישר לכולם.
    try {
      this.requestSync();
    } catch {}
  }

  requestSync() {
    console.log("[CLIENT] requestSync", { ts: Date.now() });
    this.room.send("sync");
  }

  sendTaskStarted(type: TaskType) {
    console.log("[CLIENT] sendTaskStarted", {
      type,
      myIndex: this.myIndex,
      ts: Date.now(),
    });
    this.room.send("taskStarted", { type });
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
      names: this.names,
      avatars: this.avatars,
    };

    console.log("[CLIENT] emitState", {
      ready: s.ready,
      myIndex: s.myIndex,
      currentTurn: s.currentTurn,
      canRollNow: s.canRollNow,
      names: s.names,
      ts: Date.now(),
    });

    this.emit("state", s);
  }

  getState(): NetStateView {
    return {
      ready: this.ready,
      myIndex: this.myIndex,
      currentTurn: this.currentTurn,
      canRollNow: this.canRollNowFlag,
      names: this.names,
      avatars: this.avatars,
    };
  }
}