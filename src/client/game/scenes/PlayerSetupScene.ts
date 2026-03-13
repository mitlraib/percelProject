// src/client/game/scenes/PlayerSetupScene.ts
// בחירת שם ותמונה לשחקן לפני כניסה לחדר (מוד 2/3/4)

import Phaser from "phaser";

const REGISTRY_DISPLAY_NAME = "playerDisplayName";
const REGISTRY_AVATAR_DATA_URL = "playerAvatarDataUrl";

type Mode = "solo" | "local";

export default class PlayerSetupScene extends Phaser.Scene {
  private mode: Mode = "local";
  private playerCount = 1;

  private nameInput!: HTMLInputElement;
  private fileInput!: HTMLInputElement;
  private wrapDiv!: HTMLDivElement;

  constructor() {
    super("player-setup-scene");
  }

  init(data: { mode?: Mode; playerCount?: number }) {
    this.mode = data.mode ?? "local";
    this.playerCount = data.playerCount ?? 1;
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b14).setDepth(0);

    this.add
      .text(width / 2, 80, "בחרי שם ותמונה לדמות שלך", {
        fontFamily: "Arial",
        fontSize: "28px",
        color: "#ff66cc",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 130, "השם יופיע כשזה התור שלך • התמונה תהיה הדמות על הלוח", {
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
    this.wrapDiv.style.width = "min(90vw, 360px)";
    this.wrapDiv.style.display = "flex";
    this.wrapDiv.style.flexDirection = "column";
    this.wrapDiv.style.gap = "20px";
    this.wrapDiv.style.alignItems = "stretch";
    this.wrapDiv.style.zIndex = "10000";

    const labelName = document.createElement("label");
    labelName.textContent = "שם הדמות:";
    labelName.setAttribute("for", "player-name-input");
    labelName.style.color = "#fff";
    labelName.style.fontSize = "16px";
    labelName.style.fontFamily = "Arial";
    this.wrapDiv.appendChild(labelName);

    this.nameInput = document.createElement("input");
    this.nameInput.id = "player-name-input";
    this.nameInput.type = "text";
    this.nameInput.placeholder = "למשל: מיטל";
    this.nameInput.value = this.registry.get(REGISTRY_DISPLAY_NAME) ?? "";
    this.nameInput.dir = "rtl";
    this.nameInput.style.padding = "12px 14px";
    this.nameInput.style.fontSize = "18px";
    this.nameInput.style.borderRadius = "10px";
    this.nameInput.style.border = "2px solid #2a2a44";
    this.nameInput.style.background = "#16162a";
    this.nameInput.style.color = "#fff";
    this.wrapDiv.appendChild(this.nameInput);

    const labelFile = document.createElement("label");
    labelFile.textContent = "תמונה לדמות (אופציונלי):";
    labelFile.setAttribute("for", "player-avatar-file");
    labelFile.style.color = "#fff";
    labelFile.style.fontSize = "16px";
    labelFile.style.fontFamily = "Arial";
    this.wrapDiv.appendChild(labelFile);

    this.fileInput = document.createElement("input");
    this.fileInput.id = "player-avatar-file";
    this.fileInput.type = "file";
    this.fileInput.accept = "image/*";
    this.fileInput.style.padding = "8px";
    this.fileInput.style.color = "#b7b7c9";
    this.fileInput.style.fontSize = "14px";
    this.wrapDiv.appendChild(this.fileInput);

    const btn = document.createElement("button");
    btn.textContent = "התחל משחק";
    btn.type = "button";
    btn.style.padding = "14px 24px";
    btn.style.fontSize = "20px";
    btn.style.fontWeight = "bold";
    btn.style.borderRadius = "12px";
    btn.style.border = "none";
    btn.style.background = "#ff66cc";
    btn.style.color = "#0b0b14";
    btn.style.cursor = "pointer";
    btn.style.marginTop = "10px";
    btn.onclick = () => this.onStart();
    this.wrapDiv.appendChild(btn);

    const gameCanvas = this.sys.game.canvas;
    const parent = gameCanvas.parentElement ?? document.body;
    parent.appendChild(this.wrapDiv);
  }

  private onStart() {
    const name = (this.nameInput.value || "שחקן").trim();
    this.registry.set(REGISTRY_DISPLAY_NAME, name);

    const file = this.fileInput.files?.[0];
    if (file) {
      // תמונה גדולה מדי גורמת לבעיות ברשת (Max payload size exceeded).
      // נגביל לגודל סביר ונמשיך בלי תמונה אם חורג.
      const MAX_BYTES = 150 * 1024; // ~150KB
      if (file.size > MAX_BYTES) {
        alert("התמונה שבחרת גדולה מדי. נשתמש בלי תמונה כדי שהמשחק ירוץ חלק.");
        this.registry.remove(REGISTRY_AVATAR_DATA_URL);
        this.goToNetwork();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        this.registry.set(REGISTRY_AVATAR_DATA_URL, dataUrl);
        this.goToNetwork();
      };
      reader.readAsDataURL(file);
    } else {
      this.registry.remove(REGISTRY_AVATAR_DATA_URL);
      this.goToNetwork();
    }
  }

  private goToNetwork() {
    this.removeDom();
    this.scene.start("network-scene", {
      mode: this.mode,
      playerCount: this.playerCount,
    });
  }

  private removeDom() {
    this.wrapDiv?.remove();
    this.nameInput = undefined!;
    this.fileInput = undefined!;
    this.wrapDiv = undefined!;
  }

  shutdown() {
    this.removeDom();
  }
}

export { REGISTRY_DISPLAY_NAME, REGISTRY_AVATAR_DATA_URL };
