//src\client\game\scenes\NetworkScene.ts

import Phaser from "phaser";
import * as Colyseus from "@colyseus/sdk";
import type { Room } from "@colyseus/sdk";

import NetGameController from "../controllers/NetGameController";

type Mode = "solo" | "local";

export default class NetworkScene extends Phaser.Scene {
  private client!: Colyseus.Client;
  private room?: Room;

  private mode: Mode = "local";
  private playerCount = 1;

  constructor() {
    super("network-scene");
  }

  init(data: { mode?: Mode; playerCount?: number }) {
    this.mode = data.mode ?? "local";
    this.playerCount = data.playerCount ?? 1;

    this.registry.set("mode", this.mode);
    this.registry.set("playerCount", this.playerCount);

    if (this.mode !== "solo") {
      this.client = new Colyseus.Client("ws://localhost:2567");
    }
  }

  async create() {
    // SOLO: מדלגים ישר למשחק
    if (this.mode === "solo") {
      this.registry.remove("room");
      this.registry.remove("net");
      this.scene.start("parallax-scene", { mode: this.mode, playerCount: this.playerCount });
      return;
    }

    const roomName = this.playerCount === 2 ? "duo_room" : "my_room";
    console.log("joining room ←", roomName);

    try {
      this.room = await this.client.joinOrCreate(roomName);
      console.log("joined room ✔", {
        name: this.room.name,
        sessionId: this.room.sessionId,
        roomId: this.room.roomId,
      });
    } catch (err) {
      console.error("FAILED joinOrCreate ←", err);
      return;
    }

    // חשוב: רושמים onMessage על ה-room מיד אחרי ההצטרפות, לפני שהשרת שולח assign/ready/turn (כך הקובייה והתור יעבדו)
    const net = new NetGameController(this.room, this.playerCount);
    this.registry.set("room", this.room);
    this.registry.set("net", net);
    this.game.events.emit("room-ready");

    this.scene.start("parallax-scene", { mode: this.mode, playerCount: this.playerCount });
  }
}