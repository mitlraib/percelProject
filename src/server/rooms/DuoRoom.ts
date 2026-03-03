import { Room, Client } from "colyseus";

type PlayersPayload = { count: number; players: string[] };
type AssignPayload = { playerIndex: number };
type TurnPayload = { currentTurn: number };
type MovePayload = { playerIndex: number; value: number };

export class DuoRoom extends Room {
  maxClients = 2;

  private players: string[] = []; // sessionIds לפי סדר כניסה
  private currentTurn = 0;
  private ready = false;

  onCreate() {
    // sync ← מחזיר הכל כדי שלא נפספס
    this.onMessage("sync", (client: Client) => {
      this.sendAllStateTo(client);
    });

    // roll ← רק אם זה התור של השולח ורק אם ready
    this.onMessage("roll", (client: Client, msg: any) => {
      if (!this.ready) {
        client.send("rollDenied", { reason: "not_ready" });
        return;
      }
      // בתוך DuoRoom.onCreate()

this.onMessage("penalty", (client: Client, msg: any) => {
  const idx = this.players.indexOf(client.sessionId);
  if (idx === -1) return;

  const raw = Number(msg?.deltaSteps);
  if (!Number.isFinite(raw)) return;

  // מאפשרים רק שלילי ובגבול סביר (לדוגמה: עד 10 צעדים אחורה)
  const deltaSteps = Math.max(-10, Math.min(-1, Math.floor(raw)));

  // משדרים לכולם תזוזת penalty (ללא שינוי תור)
  this.broadcast("penaltyMove", { playerIndex: idx, deltaSteps });
});

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

      // משדרים תזוזה לכולם
      const move: MovePayload = { playerIndex: idx, value };
      this.broadcast("move", move);

      // מעבירים תור
      this.currentTurn = this.currentTurn === 0 ? 1 : 0;
      this.broadcast("turn", { currentTurn: this.currentTurn } satisfies TurnPayload);
    });
  }

  onJoin(client: Client) {
    if (!this.players.includes(client.sessionId)) {
      this.players.push(client.sessionId);
    }

    // assign אישי
    const idx = this.players.indexOf(client.sessionId);
    client.send("assign", { playerIndex: idx } satisfies AssignPayload);

    // עדכון מצב
    this.ready = this.players.length === 2;

    const payload: PlayersPayload = { count: this.players.length, players: [...this.players] };
    this.broadcast("players", payload);
    this.broadcast("ready", { ok: this.ready });

    // כשנהיה ready בפעם הראשונה, נבחר התחלה (0)
    if (this.ready) {
      this.currentTurn = 0;
      this.broadcast("turn", { currentTurn: this.currentTurn } satisfies TurnPayload);
    }

    // גם ללקוח שנכנס (כמו שהיה אצלך)
    this.sendAllStateTo(client);
  }

  onLeave(client: Client) {
    this.players = this.players.filter((id) => id !== client.sessionId);

    this.ready = this.players.length === 2;

    const payload: PlayersPayload = { count: this.players.length, players: [...this.players] };
    this.broadcast("players", payload);
    this.broadcast("ready", { ok: this.ready });

    // אם מישהו עזב ← אין תור פעיל
    if (!this.ready) {
      this.broadcast("turn", { currentTurn: -1 });
    }
  }

  private sendAllStateTo(client: Client) {
    const payload: PlayersPayload = { count: this.players.length, players: [...this.players] };
    client.send("players", payload);
    client.send("ready", { ok: this.ready });

    const idx = this.players.indexOf(client.sessionId);
    if (idx >= 0) client.send("assign", { playerIndex: idx });

    client.send("turn", { currentTurn: this.ready ? this.currentTurn : -1 });
  }
}