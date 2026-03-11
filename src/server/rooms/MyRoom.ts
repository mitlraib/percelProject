// src/server/rooms/MyRoom.ts
import { Room, Client } from "colyseus";
import { MyRoomState } from "./schema/myRoomState.js";

type PlayersPayload = { count: number; players: string[] };
type AssignPayload = { playerIndex: number };
type TurnPayload = { currentTurn: number };
type MovePayload = { playerIndex: number; value: number };
type ReadyPayload = { ok: boolean };
type PlayerMeta = { name?: string; avatar?: string };
type PlayersMetaPayload = { names: (string | null)[]; avatars: (string | null)[] };

export class MyRoom extends Room {
  maxClients = 4;

  // ⭐ state (אם את משתמשת בזה בהמשך — כרגע לא חובה לתורות)
  state = new MyRoomState();

  private players: string[] = []; // sessionIds לפי סדר כניסה
  private currentTurn = 0;
  private ready = false;
  private metas: PlayerMeta[] = [];

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

      const idx = this.players.indexOf(client.sessionId);
      if (idx === -1) {
        client.send("rollDenied", { reason: "not_assigned" });
        return;
      }

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

      // מעבירים תור (מודולו לפי כמות השחקנים בפועל)
      if (this.players.length > 0) {
        this.currentTurn = (this.currentTurn + 1) % this.players.length;
      } else {
        this.currentTurn = 0;
      }

      this.broadcast("turn", { currentTurn: this.currentTurn } satisfies TurnPayload);
    });

    // penalty (משימת נועם – כישלון: 3 צעדים אחורה)
    this.onMessage("penalty", (client: Client, msg: any) => {
      const idx = this.players.indexOf(client.sessionId);
      if (idx === -1) return;

      const raw = Number(msg?.deltaSteps);
      if (!Number.isFinite(raw)) return;

      const deltaSteps = Math.max(-10, Math.min(-1, Math.floor(raw)));
      this.broadcast("penaltyMove", { playerIndex: idx, deltaSteps });
    });

    // מטא־דאטה של שחקן (שם + תמונה) – נשלח מהקליינט ומופץ לכולם
    this.onMessage("playerMeta", (client: Client, msg: any) => {
      const idx = this.players.indexOf(client.sessionId);
      if (idx === -1) return;

      const nameRaw = typeof msg?.name === "string" ? msg.name : undefined;
      const avatarRaw = typeof msg?.avatar === "string" ? msg.avatar : undefined;

      const name = nameRaw ? nameRaw.slice(0, 24) : undefined;
      const avatar =
        avatarRaw && avatarRaw.startsWith("data:image") && avatarRaw.length < 200_000
          ? avatarRaw
          : undefined;

      this.metas[idx] = { name, avatar };
      this.broadcastPlayersMeta();
    });
  }

  onJoin(client: Client) {
    // מוסיפים אם חדש
    if (!this.players.includes(client.sessionId)) {
      this.players.push(client.sessionId);
      this.metas.push({});
    }

    // assign אישי
    const idx = this.players.indexOf(client.sessionId);
    client.send("assign", { playerIndex: idx } satisfies AssignPayload);

    // ✅ ready: כדי שלא “יתחילו לבד”
    // פה אני עושה ready רק כשיש לפחות 2.
    // אם את רוצה ש-3 יעבוד רק כשיש 3, ו-4 רק כשיש 4 — תגידי לי ואשנה למנגנון requiredCount.
    this.ready = this.players.length >= 2;

    // players + ready לכל החדר
    const payload: PlayersPayload = { count: this.players.length, players: [...this.players] };
    this.broadcast("players", payload);
    this.broadcast("ready", { ok: this.ready } satisfies ReadyPayload);
    this.broadcastPlayersMeta();

    // אם נהיינו ready עכשיו, בוחרים התחלה (0)
    if (this.ready && this.currentTurn < 0) this.currentTurn = 0;
    if (this.ready) {
      // אם התור “נפל” מחוץ לטווח בגלל יציאות/כניסות — מתקנים
      if (this.currentTurn >= this.players.length) this.currentTurn = 0;
      this.broadcast("turn", { currentTurn: this.currentTurn } satisfies TurnPayload);
    } else {
      this.broadcast("turn", { currentTurn: -1 } satisfies TurnPayload);
    }

    // גם ללקוח שנכנס: שולחים לו מצב מלא
    this.sendAllStateTo(client);
  }

  onLeave(client: Client) {
    const leavingIdx = this.players.indexOf(client.sessionId);
    this.players = this.players.filter((id) => id !== client.sessionId);
    if (leavingIdx !== -1) {
      this.metas.splice(leavingIdx, 1);
    }

    // אם אף אחד לא נשאר
    if (this.players.length === 0) {
      this.ready = false;
      this.currentTurn = 0;
      return;
    }

    // אם מי שיצא היה לפני התור הנוכחי — מזיזים את currentTurn אחורה
    // כדי שהתור "ישאר על אותו אדם" לוגית.
    if (leavingIdx !== -1 && leavingIdx < this.currentTurn) {
      this.currentTurn -= 1;
    }

    // מתקנים טווח
    if (this.currentTurn < 0) this.currentTurn = 0;
    if (this.currentTurn >= this.players.length) this.currentTurn = 0;

    // ready מחדש
    this.ready = this.players.length >= 2;

    // broadcast עדכונים
    const payload: PlayersPayload = { count: this.players.length, players: [...this.players] };
    this.broadcast("players", payload);
    this.broadcast("ready", { ok: this.ready } satisfies ReadyPayload);

    // אם לא ready ← אין תור פעיל
    if (!this.ready) {
      this.broadcast("turn", { currentTurn: -1 } satisfies TurnPayload);
    } else {
      this.broadcast("turn", { currentTurn: this.currentTurn } satisfies TurnPayload);
    }
  }

  private sendAllStateTo(client: Client) {
    const payload: PlayersPayload = { count: this.players.length, players: [...this.players] };
    client.send("players", payload);
    client.send("ready", { ok: this.ready } satisfies ReadyPayload);

    const idx = this.players.indexOf(client.sessionId);
    if (idx >= 0) client.send("assign", { playerIndex: idx } satisfies AssignPayload);

    client.send("turn", { currentTurn: this.ready ? this.currentTurn : -1 } satisfies TurnPayload);

    // שולחים גם מטא־דאטה (שמות + תמונות) ללקוח שנכנס
    client.send("playersMeta", this.getPlayersMetaPayload());
  }

  private getPlayersMetaPayload(): PlayersMetaPayload {
    const names: (string | null)[] = [];
    const avatars: (string | null)[] = [];
    for (let i = 0; i < this.players.length; i++) {
      const meta = this.metas[i];
      names.push(meta?.name ?? null);
      avatars.push(meta?.avatar ?? null);
    }
    return { names, avatars };
  }

  private broadcastPlayersMeta() {
    const payload = this.getPlayersMetaPayload();
    this.broadcast("playersMeta", payload);
  }
}