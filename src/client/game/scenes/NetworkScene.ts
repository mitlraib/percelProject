//src\client\game\scenes\NetworkScene.ts

import Phaser from "phaser";
import * as Colyseus from "@colyseus/sdk";
import type { Room } from "@colyseus/sdk";

import NetGameController from "../controllers/NetGameController";

type Mode = "solo" | "local";

/** Resolve the Colyseus WebSocket endpoint.
 *
 * - When running from localhost → ws://localhost:2567  (local dev)
 * - When running from anywhere else (e.g. Render client) → wss://percelproject.onrender.com
 *
 * This hard-wires the production server URL so phones and the deployed client never try to
 * talk to the client domain.
 */
function getColyseusWsUrl(): string {
  const DEV_WS = "ws://localhost:2567";

  if (typeof window === "undefined") {
    return DEV_WS;
  }

  // Local dev: keep using localhost.
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return DEV_WS;
  }

  // Production / non-localhost: always talk directly to the Colyseus server on Render.
  return "wss://percelproject.onrender.com";
}

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
      const wsUrl = getColyseusWsUrl();
      this.client = new Colyseus.Client(wsUrl);
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

    const wsUrl = getColyseusWsUrl();
    // 2 שחקנים → duo_room, 3–4 → my_room
    const roomName = this.playerCount === 2 ? "duo_room" : "my_room";
    console.log("joining room ←", roomName, wsUrl);

    try {
      this.room = await this.client.joinOrCreate(roomName);
      console.log("joined room ✔", {
        name: this.room.name,
        sessionId: this.room.sessionId,
        roomId: this.room.roomId,
      });
    } catch (err) {
      console.error("FAILED joinOrCreate ←", err);
      this.showConnectionError(wsUrl);
      return;
    }

    // חשוב: רושמים onMessage על ה-room מיד אחרי ההצטרפות, לפני שהשרת שולח assign/ready/turn (כך הקובייה והתור יעבדו)
    const net = new NetGameController(this.room, this.playerCount);
    this.registry.set("room", this.room);
    this.registry.set("net", net);
    this.game.events.emit("room-ready");

    this.scene.start("parallax-scene", { mode: this.mode, playerCount: this.playerCount });
  }

  private showConnectionError(wsUrl: string) {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b14).setDepth(0);

    this.add
      .text(width / 2, height / 2 - 50, "לא הצלחנו להתחבר לשרת", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#ff6666",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2, "בדקו שהשרת רץ ובטלפון אתם באותו רשת / כתובת", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#b7b7c9",
        align: "center",
        wordWrap: { width: width - 80 },
      })
      .setOrigin(0.5);

    const btnW = Math.min(280, width - 60);
    const btnH = 52;
    const backBg = this.add.rectangle(0, 0, btnW, btnH, 0x2a2a44).setStrokeStyle(2, 0xff66cc);
    const backLabel = this.add.text(0, 0, "חזרה לתפריט", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
    }).setOrigin(0.5);
    const backBtn = this.add.container(width / 2, height / 2 + 80, [backBg, backLabel]).setDepth(10);
    backBtn.setSize(btnW, btnH);
    backBtn.setInteractive(
      new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains
    );
    backBtn.on("pointerdown", () => {
      this.scene.start("menu-scene");
    });
  }
}