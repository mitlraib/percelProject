// src/server/rooms/MultiRoom.ts
import { Room, Client } from "colyseus";

type PlayersPayload = { count: number; players: string[] };
type AssignPayload = { playerIndex: number };
type TurnPayload = { currentTurn: number };
type MovePayload = { playerIndex: number; value: number };
type PenaltyPayload = { playerIndex: number; deltaSteps: number };

export class MultiRoom extends Room {
  maxClients = 4;

  private players: string[] = [];
  private currentTurn = 0;
  private ready = false;

 onCreate() {
  this.onMessage("sync", (client: Client) => {
    this.sendAllStateTo(client);
  });

  this.onMessage("roll", (client: Client, msg: any) => {
    if (!this.ready) {
      client.send("rollDenied", { reason: "not_ready" });
      return;
    }

    const idx = this.players.indexOf(client.sessionId);
    if (idx === -1) return;

    if (idx !== this.currentTurn) {
      client.send("rollDenied", { reason: "not_your_turn", currentTurn: this.currentTurn });
      return;
    }

    const raw = Number(msg?.value);
    if (!Number.isFinite(raw)) {
      client.send("rollDenied", { reason: "bad_value" });
      return;
    }

    const value = Math.max(1, Math.min(6, Math.floor(raw)));

    this.broadcast("move", { playerIndex: idx, value });

    this.currentTurn = (this.currentTurn + 1) % this.players.length;
    this.broadcast("turn", { currentTurn: this.currentTurn });
  });

  // ✅ penalty (משימת נועם)
  this.onMessage("penalty", (client: Client, msg: any) => {
    const idx = this.players.indexOf(client.sessionId);
    if (idx === -1) return;

    const raw = Number(msg?.deltaSteps);
    if (!Number.isFinite(raw)) return;

    const deltaSteps = Math.max(-10, Math.min(-1, Math.floor(raw)));
    this.broadcast("penaltyMove", { playerIndex: idx, deltaSteps });
  });
}
  onJoin(client: Client) {
    if (!this.players.includes(client.sessionId)) {
      this.players.push(client.sessionId);
    }

    const idx = this.players.indexOf(client.sessionId);
    client.send("assign", { playerIndex: idx } satisfies AssignPayload);

    this.ready = this.players.length >= 3; // מוכן מ־3 ומעלה
    this.broadcast("players", { count: this.players.length, players: [...this.players] } satisfies PlayersPayload);
    this.broadcast("ready", { ok: this.ready });

    if (this.ready) {
      // רק אם אין תור פעיל עדיין (פשוט)
      if (this.currentTurn < 0 || this.currentTurn >= this.players.length) this.currentTurn = 0;
      this.broadcast("turn", { currentTurn: this.currentTurn } satisfies TurnPayload);
    } else {
      this.broadcast("turn", { currentTurn: -1 } satisfies TurnPayload);
    }

    this.sendAllStateTo(client);
  }

  onLeave(client: Client) {
    this.players = this.players.filter((id) => id !== client.sessionId);

    this.ready = this.players.length >= 3;

    this.broadcast("players", { count: this.players.length, players: [...this.players] } satisfies PlayersPayload);
    this.broadcast("ready", { ok: this.ready });

    if (!this.ready) {
      this.broadcast("turn", { currentTurn: -1 } satisfies TurnPayload);
      return;
    }

    // אם currentTurn יצא מהטווח אחרי יציאה
    if (this.currentTurn >= this.players.length) this.currentTurn = 0;
    this.broadcast("turn", { currentTurn: this.currentTurn } satisfies TurnPayload);
  }

  private sendAllStateTo(client: Client) {
    client.send("players", { count: this.players.length, players: [...this.players] } satisfies PlayersPayload);
    client.send("ready", { ok: this.ready });

    const idx = this.players.indexOf(client.sessionId);
    if (idx >= 0) client.send("assign", { playerIndex: idx } satisfies AssignPayload);

    client.send("turn", { currentTurn: this.ready ? this.currentTurn : -1 } satisfies TurnPayload);
  }
}