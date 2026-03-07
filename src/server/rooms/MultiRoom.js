// src/server/rooms/MultiRoom.ts
import { Room } from "colyseus";
export class MultiRoom extends Room {
    maxClients = 4;
    players = [];
    currentTurn = 0;
    ready = false;
    onCreate() {
        this.onMessage("sync", (client) => {
            this.sendAllStateTo(client);
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
            this.broadcast("move", { playerIndex: idx, value });
            this.currentTurn = (this.currentTurn + 1) % this.players.length;
            this.broadcast("turn", { currentTurn: this.currentTurn });
        });
        // ✅ penalty (משימת נועם)
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
        if (!this.players.includes(client.sessionId)) {
            this.players.push(client.sessionId);
        }
        const idx = this.players.indexOf(client.sessionId);
        client.send("assign", { playerIndex: idx });
        this.ready = this.players.length >= 3; // מוכן מ־3 ומעלה
        this.broadcast("players", { count: this.players.length, players: [...this.players] });
        this.broadcast("ready", { ok: this.ready });
        if (this.ready) {
            // רק אם אין תור פעיל עדיין (פשוט)
            if (this.currentTurn < 0 || this.currentTurn >= this.players.length)
                this.currentTurn = 0;
            this.broadcast("turn", { currentTurn: this.currentTurn });
        }
        else {
            this.broadcast("turn", { currentTurn: -1 });
        }
        this.sendAllStateTo(client);
    }
    onLeave(client) {
        this.players = this.players.filter((id) => id !== client.sessionId);
        this.ready = this.players.length >= 3;
        this.broadcast("players", { count: this.players.length, players: [...this.players] });
        this.broadcast("ready", { ok: this.ready });
        if (!this.ready) {
            this.broadcast("turn", { currentTurn: -1 });
            return;
        }
        // אם currentTurn יצא מהטווח אחרי יציאה
        if (this.currentTurn >= this.players.length)
            this.currentTurn = 0;
        this.broadcast("turn", { currentTurn: this.currentTurn });
    }
    sendAllStateTo(client) {
        client.send("players", { count: this.players.length, players: [...this.players] });
        client.send("ready", { ok: this.ready });
        const idx = this.players.indexOf(client.sessionId);
        if (idx >= 0)
            client.send("assign", { playerIndex: idx });
        client.send("turn", { currentTurn: this.ready ? this.currentTurn : -1 });
    }
}
