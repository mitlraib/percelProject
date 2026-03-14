import { Room, Client } from "colyseus";

type PlayersPayload = { count: number; players: string[] };
type AssignPayload = { playerIndex: number };
type TurnPayload = { currentTurn: number };
type MovePayload = { playerIndex: number; value: number };
type PlayerMeta = { name?: string; avatar?: string };
type PlayersMetaPayload = { names: (string | null)[]; avatars: (string | null)[] };

const KALI_NAME = "קלי";

export class DuoRoom extends Room {
  maxClients = 2;

  private players: string[] = [];
  private currentTurn = 0;
  private ready = false;
  private metas: PlayerMeta[] = [];

  /** מחזיר את האינדקס של השחקן ששמו "קלי", או -1 אם אין. קלי תמיד מתחילה ראשונה. */
  private getKaliIndex(): number {
    for (let i = 0; i < this.metas.length; i++) {
      const name = this.metas[i]?.name?.trim();
      if (name === KALI_NAME) return i;
    }
    return -1;
  }

  private applyKaliFirstTurn() {
    if (!this.ready || this.players.length === 0) return;
    const kaliIdx = this.getKaliIndex();
    this.currentTurn = kaliIdx >= 0 ? kaliIdx : 0;
    this.broadcast("turn", { currentTurn: this.currentTurn } satisfies TurnPayload);
  }

  onCreate() {
    console.log("[SERVER][DuoRoom] onCreate", {
      roomId: this.roomId,
      createdAt: new Date().toISOString(),
    });
  
    this.onMessage("sync", (client: Client) => {
      console.log("[SERVER][DuoRoom] sync received", {
        roomId: this.roomId,
        sessionId: client.sessionId,
        at: Date.now(),
        playersCount: this.players.length,
        currentTurn: this.currentTurn,
        ready: this.ready,
      });
  
      this.sendAllStateTo(client);
    });
  
    this.onMessage("penalty", (client: Client, msg: any) => {
      const idx = this.players.indexOf(client.sessionId);
  
      console.log("[SERVER][DuoRoom] penalty received", {
        roomId: this.roomId,
        sessionId: client.sessionId,
        idx,
        rawMsg: msg,
        at: Date.now(),
      });
  
      if (idx === -1) return;
  
      const raw = Number(msg?.deltaSteps);
      if (!Number.isFinite(raw)) return;
  
      const deltaSteps = Math.max(-10, Math.min(-1, Math.floor(raw)));
  
      console.log("[SERVER][DuoRoom] broadcasting penaltyMove", {
        roomId: this.roomId,
        playerIndex: idx,
        deltaSteps,
        at: Date.now(),
      });
  
      this.broadcast("penaltyMove", { playerIndex: idx, deltaSteps });
    });
  
    this.onMessage("playerMeta", (client: Client, msg: any) => {
      const idx = this.players.indexOf(client.sessionId);
  
      console.log("[SERVER][DuoRoom] playerMeta received", {
        roomId: this.roomId,
        sessionId: client.sessionId,
        idx,
        hasName: typeof msg?.name === "string",
        hasAvatar:
          typeof msg?.avatar === "string" &&
          msg.avatar.startsWith("data:image"),
        avatarLength:
          typeof msg?.avatar === "string" ? msg.avatar.length : null,
        at: Date.now(),
      });
  
      if (idx === -1) return;
  
      const nameRaw = typeof msg?.name === "string" ? msg.name : undefined;
      const avatarRaw = typeof msg?.avatar === "string" ? msg.avatar : undefined;
  
      const name = nameRaw ? nameRaw.slice(0, 24) : undefined;
      const avatar =
        avatarRaw && avatarRaw.startsWith("data:image") && avatarRaw.length < 200_000
          ? avatarRaw
          : undefined;
  
      this.metas[idx] = { name, avatar };
  
      console.log("[SERVER][DuoRoom] playerMeta saved", {
        roomId: this.roomId,
        idx,
        name,
        hasAvatar: !!avatar,
        at: Date.now(),
      });
  
      this.broadcastPlayersMeta();
      this.applyKaliFirstTurn();
    });
  
    // משימה נפתחה אצל שחקן – משדרים לכולם כדי להציג "X עוזר לי כרגע" אצל השאר
    this.onMessage("taskStarted", (client: Client, msg: any) => {
      const idx = this.players.indexOf(client.sessionId);
  
      console.log("[SERVER][DuoRoom] taskStarted received", {
        roomId: this.roomId,
        sessionId: client.sessionId,
        idx,
        rawMsg: msg,
        at: Date.now(),
      });
  
      if (idx === -1) {
        console.log("[SERVER][DuoRoom] taskStarted ignored - client not found", {
          roomId: this.roomId,
          sessionId: client.sessionId,
          at: Date.now(),
        });
        return;
      }
  
      const rawType = msg?.type;
      const type: "mom" | "noam" | "dad" =
        rawType === "noam" ? "noam" : rawType === "dad" ? "dad" : "mom";
  
      console.log("[SERVER][DuoRoom] broadcasting taskStarted", {
        roomId: this.roomId,
        playerIndex: idx,
        type,
        at: Date.now(),
      });
  
      this.broadcast("taskStarted", { type, playerIndex: idx });
    });
  
    this.onMessage("roll", (client: Client, msg: any) => {
      console.log("[SERVER][DuoRoom] roll received", {
        roomId: this.roomId,
        sessionId: client.sessionId,
        rawMsg: msg,
        at: Date.now(),
        ready: this.ready,
        currentTurn: this.currentTurn,
        players: [...this.players],
      });
  
      if (!this.ready) {
        client.send("rollDenied", { reason: "not_ready" });
        return;
      }
  
      const idx = this.players.indexOf(client.sessionId);
      if (idx === -1) return;
  
      if (idx !== this.currentTurn) {
        client.send("rollDenied", {
          reason: "not_your_turn",
          currentTurn: this.currentTurn,
        });
        return;
      }
  
      const raw = Number(msg?.value);
      if (!Number.isFinite(raw)) {
        client.send("rollDenied", { reason: "bad_value" });
        return;
      }
  
      const value = Math.max(1, Math.min(6, Math.floor(raw)));
  
      console.log("[SERVER][DuoRoom] roll accepted", {
        roomId: this.roomId,
        playerIndex: idx,
        value,
        at: Date.now(),
      });
  
      const move: MovePayload = { playerIndex: idx, value };
  
      console.log("[SERVER][DuoRoom] broadcasting move", {
        roomId: this.roomId,
        move,
        at: Date.now(),
      });
      this.broadcast("move", move);
  
      this.currentTurn = this.currentTurn === 0 ? 1 : 0;
  
      console.log("[SERVER][DuoRoom] broadcasting next turn", {
        roomId: this.roomId,
        nextTurn: this.currentTurn,
        at: Date.now(),
      });
      this.broadcast("turn", { currentTurn: this.currentTurn } satisfies TurnPayload);
    });
  }

  onJoin(client: Client) {
    console.log("[SERVER][DuoRoom] onJoin start", {
      roomId: this.roomId,
      sessionId: client.sessionId,
      at: Date.now(),
      playersBefore: [...this.players],
    });

    if (!this.players.includes(client.sessionId)) {
      this.players.push(client.sessionId);
      this.metas.push({});
    }

    const idx = this.players.indexOf(client.sessionId);
    client.send("assign", { playerIndex: idx } satisfies AssignPayload);

    this.ready = this.players.length === 2;

    const payload: PlayersPayload = {
      count: this.players.length,
      players: [...this.players],
    };

    console.log("[SERVER][DuoRoom] onJoin broadcasting room state", {
      roomId: this.roomId,
      joinedIndex: idx,
      players: [...this.players],
      ready: this.ready,
      currentTurn: this.currentTurn,
      at: Date.now(),
    });

    this.broadcast("players", payload);
    this.broadcast("ready", { ok: this.ready });
    this.broadcastPlayersMeta();

    if (this.ready) {
      this.applyKaliFirstTurn();
      console.log("[SERVER][DuoRoom] room became ready", {
        roomId: this.roomId,
        currentTurn: this.currentTurn,
        at: Date.now(),
      });
    }

    this.sendAllStateTo(client);

    console.log("[SERVER][DuoRoom] onJoin end", {
      roomId: this.roomId,
      sessionId: client.sessionId,
      playersAfter: [...this.players],
      ready: this.ready,
      currentTurn: this.currentTurn,
      at: Date.now(),
    });
  }

  onLeave(client: Client) {
    console.log("[SERVER][DuoRoom] onLeave start", {
      roomId: this.roomId,
      sessionId: client.sessionId,
      at: Date.now(),
      playersBefore: [...this.players],
    });

    const idx = this.players.indexOf(client.sessionId);
    this.players = this.players.filter((id) => id !== client.sessionId);

    if (idx !== -1) {
      this.metas.splice(idx, 1);
    }

    this.ready = this.players.length === 2;

    const payload: PlayersPayload = {
      count: this.players.length,
      players: [...this.players],
    };

    console.log("[SERVER][DuoRoom] onLeave broadcasting room state", {
      roomId: this.roomId,
      removedIndex: idx,
      playersAfter: [...this.players],
      ready: this.ready,
      currentTurn: this.currentTurn,
      at: Date.now(),
    });

    this.broadcast("players", payload);
    this.broadcast("ready", { ok: this.ready });

    if (!this.ready) {
      console.log("[SERVER][DuoRoom] room no longer ready, broadcasting turn -1", {
        roomId: this.roomId,
        at: Date.now(),
      });

      this.broadcast("turn", { currentTurn: -1 });
    }
  }

  private sendAllStateTo(client: Client) {
    const payload: PlayersPayload = {
      count: this.players.length,
      players: [...this.players],
    };

    const idx = this.players.indexOf(client.sessionId);

    console.log("[SERVER][DuoRoom] sendAllStateTo", {
      roomId: this.roomId,
      sessionId: client.sessionId,
      idx,
      ready: this.ready,
      currentTurn: this.ready ? this.currentTurn : -1,
      players: [...this.players],
      at: Date.now(),
    });

    client.send("players", payload);
    client.send("ready", { ok: this.ready });

    if (idx >= 0) {
      client.send("assign", { playerIndex: idx });
    }

    client.send("turn", { currentTurn: this.ready ? this.currentTurn : -1 });
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

    console.log("[SERVER][DuoRoom] broadcasting playersMeta", {
      roomId: this.roomId,
      names: payload.names,
      avatarLengths: payload.avatars.map((a) => (a ? a.length : null)),
      at: Date.now(),
    });

    this.broadcast("playersMeta", payload);
  }
}