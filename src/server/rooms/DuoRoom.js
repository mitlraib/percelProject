import { Room } from "colyseus";
export class DuoRoom extends Room {
    maxClients = 2;
    players = []; // sessionIds לפי סדר כניסה
    currentTurn = 0;
    ready = false;
    onCreate() {
        this.onMessage("sync", (client) => {
            this.sendAllStateTo(client);
        });
        // penalty (משימת נועם – כישלון: 3 צעדים אחורה) – רשום פעם אחת, לא בתוך roll
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
        this.onMessage("roll", (client, msg) => {
            if (!this.ready) {
                client.send("rollDenied", { reason: "not_ready" });
                return;
            }
            const idx = this.players.indexOf(client.sessionId);
            if (idx === -1)
                return;
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
            const move = { playerIndex: idx, value };
            this.broadcast("move", move);
            this.currentTurn = this.currentTurn === 0 ? 1 : 0;
            this.broadcast("turn", { currentTurn: this.currentTurn });
        });
    }
    onJoin(client) {
        if (!this.players.includes(client.sessionId)) {
            this.players.push(client.sessionId);
        }
        // assign אישי
        const idx = this.players.indexOf(client.sessionId);
        client.send("assign", { playerIndex: idx });
        // עדכון מצב
        this.ready = this.players.length === 2;
        const payload = { count: this.players.length, players: [...this.players] };
        this.broadcast("players", payload);
        this.broadcast("ready", { ok: this.ready });
        // כשנהיה ready בפעם הראשונה, נבחר התחלה (0)
        if (this.ready) {
            this.currentTurn = 0;
            this.broadcast("turn", { currentTurn: this.currentTurn });
        }
        // גם ללקוח שנכנס (כמו שהיה אצלך)
        this.sendAllStateTo(client);
    }
    onLeave(client) {
        this.players = this.players.filter((id) => id !== client.sessionId);
        this.ready = this.players.length === 2;
        const payload = { count: this.players.length, players: [...this.players] };
        this.broadcast("players", payload);
        this.broadcast("ready", { ok: this.ready });
        // אם מישהו עזב ← אין תור פעיל
        if (!this.ready) {
            this.broadcast("turn", { currentTurn: -1 });
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
