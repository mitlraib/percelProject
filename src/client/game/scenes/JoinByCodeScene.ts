// סצנה להצטרפות עם קוד חדר – מבטיחה ששני השחקנים באותו חדר

import Phaser from "phaser";

const REGISTRY_ROOM_CODE_TO_JOIN = "roomCodeToJoin";

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
      .text(width / 2, 100, "הצטרפי עם קוד חדר", {
        fontFamily: "Arial",
        fontSize: "28px",
        color: "#ff66cc",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 155, "השחקנית השנייה מזינה את הקוד שקיבלת", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#b7b7c9",
      })
      .setOrigin(0.5);

    this.wrapDiv = document.createElement("div");
    this.wrapDiv.style.position = "absolute";
    this.wrapDiv.style.left = "50%";
    this.wrapDiv.style.top = "200px";
    this.wrapDiv.style.transform = "translateX(-50%)";
    this.wrapDiv.style.width = "min(90vw, 320px)";
    this.wrapDiv.style.display = "flex";
    this.wrapDiv.style.flexDirection = "column";
    this.wrapDiv.style.gap = "16px";
    this.wrapDiv.style.alignItems = "stretch";
    this.wrapDiv.style.zIndex = "10000";

    const label = document.createElement("label");
    label.textContent = "קוד חדר:";
    label.style.color = "#fff";
    label.style.fontSize = "16px";
    label.style.fontFamily = "Arial";
    this.wrapDiv.appendChild(label);

    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.placeholder = "למשל: PPYN-SUqJ";
    this.inputEl.autocomplete = "off";
    this.inputEl.style.padding = "14px 16px";
    this.inputEl.style.fontSize = "18px";
    this.inputEl.style.borderRadius = "10px";
    this.inputEl.style.border = "2px solid #2a2a44";
    this.inputEl.style.background = "#16162a";
    this.inputEl.style.color = "#fff";
    this.wrapDiv.appendChild(this.inputEl);

    const btn = document.createElement("button");
    btn.textContent = "הצטרף לחדר";
    btn.type = "button";
    btn.style.padding = "14px 24px";
    btn.style.fontSize = "20px";
    btn.style.fontWeight = "bold";
    btn.style.borderRadius = "12px";
    btn.style.border = "none";
    btn.style.background = "#ff66cc";
    btn.style.color = "#0b0b14";
    btn.style.cursor = "pointer";
    btn.onclick = () => this.onJoin();
    this.wrapDiv.appendChild(btn);

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
    const code = (this.inputEl.value || "").trim();
    if (!code) return;

    this.registry.set(REGISTRY_ROOM_CODE_TO_JOIN, code);
    this.registry.set("playerCount", 2);
    this.registry.set("mode", "local");
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
