//src\client\game\scenes\MenuScene.ts

import Phaser from "phaser";

type PlayerOption = {
  count: number;
  label: string;
  desc: string;
  emoji: string;
};

const PLAYER_OPTIONS: PlayerOption[] = [
  { count: 1, label: "בדד אלך", desc: "זה רק אני והבוט שנגדי", emoji: "👰" },
  { count: 2, label: "שתיים זה תמיד ביחד", desc: "רק אני והבסטי", emoji: "⚔️" },
  { count: 3, label: "שלוש חברות", desc: "אני ושתי חברות", emoji: "🏰" },
  { count: 4, label: "אללה פארטי", desc: " ארבע בנות עושות פה קומונה", emoji: "🎪" },
];

export default class MenuScene extends Phaser.Scene {
  private selected: number | null = null;

  private optionButtons: Array<{
    opt: PlayerOption;
    container: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Rectangle;
  }> = [];

  private startBtn!: Phaser.GameObjects.Container;
  private startBg!: Phaser.GameObjects.Rectangle;
  private startLabel!: Phaser.GameObjects.Text;

  constructor() {
    super("menu-scene");
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b14).setDepth(0);

    // Title
    this.add
      .text(width / 2, 90, "✨ המסע לחתונה ✨", {
        fontFamily: "Arial",
        fontSize: "54px",
        fontStyle: "bold",
        color: "#ff66cc",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 145, "הדרך לחתונה רצופה בכוונות טובות", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#66ccff",
      })
      .setOrigin(0.5);

    // Grid layout
    const cols = 2;
    const cardW = Math.min(320, Math.floor(width * 0.42));
    const cardH = 140;
    const gap = 18;

    const gridW = cols * cardW + (cols - 1) * gap;
    const startX = width / 2 - gridW / 2;
    const startY = 220;

    const startGame = (count: number) => {
      const mode: "solo" | "local" = count === 1 ? "solo" : "local";
      this.registry.set("playerCount", count);
      this.registry.set("mode", mode);
      this.scene.start("network-scene", { mode, playerCount: count });
    };

    PLAYER_OPTIONS.forEach((opt, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = startX + col * (cardW + gap) + cardW / 2;
      const y = startY + row * (cardH + gap) + cardH / 2;

      const bg = this.add
        .rectangle(0, 0, cardW, cardH, 0x16162a, 1)
        .setStrokeStyle(2, 0x2a2a44, 1);

      const emoji = this.add
        .text(-cardW / 2 + 26, -cardH / 2 + 18, opt.emoji, {
          fontFamily: "Arial",
          fontSize: "32px",
          color: "#ffffff",
        })
        .setOrigin(0, 0);

      const label = this.add
        .text(-cardW / 2 + 80, -cardH / 2 + 18, opt.label, {
          fontFamily: "Arial",
          fontSize: "18px",
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0, 0);

      const desc = this.add
        .text(-cardW / 2 + 80, -cardH / 2 + 48, opt.desc, {
          fontFamily: "Arial",
          fontSize: "14px",
          color: "#b7b7c9",
        })
        .setOrigin(0, 0);

      const container = this.add.container(x, y, [bg, emoji, label, desc]).setDepth(2);

      container.setSize(cardW, cardH);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
        Phaser.Geom.Rectangle.Contains
      );

      container.on("pointerover", () => {
        if (this.selected !== opt.count) bg.setStrokeStyle(2, 0xff66cc, 0.5);
        this.input.setDefaultCursor("pointer");
      });

      container.on("pointerout", () => {
        if (this.selected !== opt.count) bg.setStrokeStyle(2, 0x2a2a44, 1);
        this.input.setDefaultCursor("default");
      });

      container.on("pointerdown", () => {
        this.setSelected(opt.count);
        startGame(opt.count);
      });

      // entrance tween
      container.setAlpha(0);
      container.y += 20;
      this.tweens.add({
        targets: container,
        alpha: 1,
        y: container.y - 20,
        duration: 350,
        delay: 200 + i * 80,
        ease: "Sine.out",
      });

      this.optionButtons.push({ opt, container, bg });
    });

    // Start button
    const btnW = Math.min(420, Math.floor(width * 0.7));
    const btnH = 64;

    this.startBg = this.add
      .rectangle(0, 0, btnW, btnH, 0x2a2a44, 1)
      .setStrokeStyle(2, 0x2a2a44, 1);

    this.startLabel = this.add
      .text(0, 0, "🎲 Start Adventure!", {
        fontFamily: "Arial",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#9a9ab3",
      })
      .setOrigin(0.5);

    this.startBtn = this.add.container(width / 2, startY + 2 * (cardH + gap) + 90, [
      this.startBg,
      this.startLabel,
    ]);

    this.startBtn.setSize(btnW, btnH);
    this.startBtn.setDepth(3);

    this.startBtn.setInteractive(
      new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains
    );

    this.startBtn.on("pointerover", () => {
      if (this.selected !== null) {
        this.startBg.setStrokeStyle(2, 0xff66cc, 1);
        this.startBtn.setScale(1.03);
      }
      this.input.setDefaultCursor(this.selected !== null ? "pointer" : "not-allowed");
    });

    this.startBtn.on("pointerout", () => {
      this.startBtn.setScale(1);
      this.refreshStartButton();
      this.input.setDefaultCursor("default");
    });

    this.startBtn.on("pointerdown", () => {
      if (this.selected === null) return;
      startGame(this.selected);
    });

    this.startBtn.setAlpha(0);
    this.startBtn.y += 20;
    this.tweens.add({
      targets: this.startBtn,
      alpha: 1,
      y: this.startBtn.y - 20,
      duration: 350,
      delay: 650,
      ease: "Sine.out",
    });

    this.refreshStartButton();
  }

  private setSelected(count: number) {
    this.selected = count;

    for (const b of this.optionButtons) {
      const isSelected = b.opt.count === count;

      b.bg.setFillStyle(isSelected ? 0x201033 : 0x16162a, 1);
      b.bg.setStrokeStyle(2, isSelected ? 0xff66cc : 0x2a2a44, 1);

      b.container.setScale(isSelected ? 1.02 : 1);
    }

    this.refreshStartButton();
  }

  private refreshStartButton() {
    const enabled = this.selected !== null;

    if (enabled) {
      this.startBg.setFillStyle(0xff66cc, 1);
      this.startBg.setStrokeStyle(2, 0xff66cc, 1);
      this.startLabel.setColor("#0b0b14");
    } else {
      this.startBg.setFillStyle(0x2a2a44, 1);
      this.startBg.setStrokeStyle(2, 0x2a2a44, 1);
      this.startLabel.setColor("#9a9ab3");
    }
  }
}