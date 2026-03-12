import Phaser from "phaser";
import { REGISTRY_ROOM_CODE } from "./PlayerSetupScene";

// סצנה להצטרפות עם קוד חדר קצר (4 תווים) – השחקנית השנייה מזינה את הקוד שקיבלה
export default class JoinByCodeScene extends Phaser.Scene {
  private inputEl!: HTMLInputElement;
  private wrapDiv!: HTMLDivElement;

  constructor() {
    super("join-by-code-scene");
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b14).setDepth(0);

    this.add
      .text(width / 2, 90, "הצטרפי עם קוד חדר", {
        fontFamily: "Arial",
        fontSize: "28px",
        color: "#ff66cc",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 135, "הקלידי את 4 התווים שקיבלת מהשחקנית המארחת", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#b7b7c9",
      })
      .setOrigin(0.5);

    this.wrapDiv = document.createElement("div");
    this.wrapDiv.style.position = "absolute";
    this.wrapDiv.style.left = "50%";
    this.wrapDiv.style.top = "180px";
    this.wrapDiv.style.transform = "translateX(-50%)";
    this.wrapDiv.style.width = "min(90vw, 300px)";
    this.wrapDiv.style.display = "flex";
    this.wrapDiv.style.flexDirection = "column";
    this.wrapDiv.style.gap = "16px";
    this.wrapDiv.style.alignItems = "stretch";
    this.wrapDiv.style.zIndex = "10000";

    const label = document.createElement("label");
    label.textContent = "קוד חדר (4 תווים):";
    label.style.color = "#fff";
    label.style.fontSize = "16px";
    label.style.fontFamily = "Arial";
    this.wrapDiv.appendChild(label);

    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.maxLength = 4;
    this.inputEl.placeholder = "למשל: A7KD";
    this.inputEl.autocomplete = "off";
    this.inputEl.style.padding = "12px 14px";
    this.inputEl.style.fontSize = "20px";
    this.inputEl.style.textTransform = "uppercase";
    this.inputEl.style.borderRadius = "10px";
    this.inputEl.style.border = "2px solid #2a2a44";
    this.inputEl.style.background = "#16162a";
    this.inputEl.style.color = "#fff";
    this.wrapDiv.appendChild(this.inputEl);

    const joinBtn = document.createElement("button");
    joinBtn.textContent = "הצטרפי למשחק";
    joinBtn.type = "button";
    joinBtn.style.padding = "12px 20px";
    joinBtn.style.fontSize = "18px";
    joinBtn.style.fontWeight = "bold";
    joinBtn.style.borderRadius = "10px";
    joinBtn.style.border = "none";
    joinBtn.style.background = "#ff66cc";
    joinBtn.style.color = "#0b0b14";
    joinBtn.style.cursor = "pointer";
    joinBtn.onclick = () => this.onJoin();
    this.wrapDiv.appendChild(joinBtn);

    const backBtn = document.createElement("button");
    backBtn.textContent = "חזרה לתפריט";
    backBtn.type = "button";
    backBtn.style.padding = "10px 16px";
    backBtn.style.fontSize = "16px";
    backBtn.style.borderRadius = "8px";
    backBtn.style.border = "1px solid #666";
    backBtn.style.background = "transparent";
    backBtn.style.color = "#b7b7c9";
    backBtn.style.cursor = "pointer";
    backBtn.onclick = () => this.goBack();
    this.wrapDiv.appendChild(backBtn);

    const gameCanvas = this.sys.game.canvas;
    const parent = gameCanvas.parentElement ?? document.body;
    parent.appendChild(this.wrapDiv);
  }

  private onJoin() {
    const raw = (this.inputEl.value || "").trim().toUpperCase();
    if (raw.length !== 4) return;

    this.registry.set(REGISTRY_ROOM_CODE, raw);
    this.registry.set("mode", "local");
    this.registry.set("playerCount", 2);

    this.removeDom();
    this.scene.start("player-setup-scene", { mode: "local" as const, playerCount: 2 });
  }

  private goBack() {
    this.removeDom();
    this.scene.start("menu-scene");
  }

  private removeDom() {
    this.wrapDiv?.remove();
    this.inputEl = undefined!;
    this.wrapDiv = undefined!;
  }

  shutdown() {
    this.removeDom();
  }
}

