// src/server/rooms/MyRoom.ts
import { Room } from "colyseus";
import { MyRoomState } from "./schema/myRoomState.js";
export class MyRoom extends Room {
    maxClients = 4;
    // ⭐ state (אם את משתמשת בזה בהמשך — כרגע לא חובה לתורות)
    state = new MyRoomState();
    players = []; // sessionIds לפי סדר כניסה
    currentTurn = 0;
    ready = false;
    onCreate() {
        // sync ← מחזיר הכל כדי שלא נפספס
        this.onMessage("sync", (client) => {
            this.sendAllStateTo(client);
        });
        // roll ← רק אם זה התור של השולח ורק אם ready
        this.onMessage("roll", (client, msg) => {
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
            const move = { playerIndex: idx, value };
            this.broadcast("move", move);
            // מעבירים תור (מודולו לפי כמות השחקנים בפועל)
            if (this.players.length > 0) {
                this.currentTurn = (this.currentTurn + 1) % this.players.length;
            }
            else {
                this.currentTurn = 0;
            }
            this.broadcast("turn", { currentTurn: this.currentTurn });
        });
        // penalty (משימת נועם – כישלון: 3 צעדים אחורה)
        this.onMessage("penalty", (client, msg) => {
            const idx = this.players.indexOf(client.sessionId);
            if (idx === -1)
                return;
            const raw = Number(msg?.deltaSteps);
            if (!Number.isFinite(raw))
                return;
            const deltaSteps = Math.max(-10, Math.min(-1, Math.floor(raw)));
            this.broadcast("penaltyMove", { playerIndex: idx, deltaSteps });
        });
    }
    onJoin(client) {
        // מוסיפים אם חדש
        if (!this.players.includes(client.sessionId)) {
            this.players.push(client.sessionId);
        }
        // assign אישי
        const idx = this.players.indexOf(client.sessionId);
        client.send("assign", { playerIndex: idx });
        // ✅ ready: כדי שלא “יתחילו לבד”
        // פה אני עושה ready רק כשיש לפחות 2.
        // אם את רוצה ש-3 יעבוד רק כשיש 3, ו-4 רק כשיש 4 — תגידי לי ואשנה למנגנון requiredCount.
        this.ready = this.players.length >= 2;
        // players + ready לכל החדר
        const payload = { count: this.players.length, players: [...this.players] };
        this.broadcast("players", payload);
        this.broadcast("ready", { ok: this.ready });
        // אם נהיינו ready עכשיו, בוחרים התחלה (0)
        if (this.ready && this.currentTurn < 0)
            this.currentTurn = 0;
        if (this.ready) {
            // אם התור “נפל” מחוץ לטווח בגלל יציאות/כניסות — מתקנים
            if (this.currentTurn >= this.players.length)
                this.currentTurn = 0;
            this.broadcast("turn", { currentTurn: this.currentTurn });
        }
        else {
            this.broadcast("turn", { currentTurn: -1 });
        }
        // גם ללקוח שנכנס: שולחים לו מצב מלא
        this.sendAllStateTo(client);
    }
    onLeave(client) {
        const leavingIdx = this.players.indexOf(client.sessionId);
        this.players = this.players.filter((id) => id !== client.sessionId);
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
        if (this.currentTurn < 0)
            this.currentTurn = 0;
        if (this.currentTurn >= this.players.length)
            this.currentTurn = 0;
        // ready מחדש
        this.ready = this.players.length >= 2;
        // broadcast עדכונים
        const payload = { count: this.players.length, players: [...this.players] };
        this.broadcast("players", payload);
        this.broadcast("ready", { ok: this.ready });
        // אם לא ready ← אין תור פעיל
        if (!this.ready) {
            this.broadcast("turn", { currentTurn: -1 });
        }
        else {
            this.broadcast("turn", { currentTurn: this.currentTurn });
        }
    }
    sendAllStateTo(client) {
        const payload = { count: this.players.length, players: [...this.players] };
        client.send("players", payload);
        client.send("ready", { ok: this.ready });
        const idx = this.players.indexOf(client.sessionId);
        if (idx >= 0)
            client.send("assign", { playerIndex: idx });
        client.send("turn", { currentTurn: this.ready ? this.currentTurn : -1 });
    }
}
