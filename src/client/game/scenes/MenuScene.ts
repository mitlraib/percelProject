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
  { count: 4, label: "אללה פארטי", desc: "ארבע בנות עושות פה קומונה", emoji: "🎪" },
];

export default class MenuScene extends Phaser.Scene {
  private selected: number | null = null;

  private optionButtons: Array<{
    opt: PlayerOption;
    container: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Rectangle;
  }> = [];

  constructor() {
    super("menu-scene");
  }

  create() {
    const { width, height } = this.scale;
    const isMobile = !!(this.sys.game.device.os.android || this.sys.game.device.os.iOS);
    const isPortrait = height > width;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b14).setDepth(0);

    // במובייל: כותרת ותת־כותרת קומפקטיות כדי שכל 4 האפשרויות ייכנסו במסך
    const titleY = isMobile ? 14 : 90;
    const titleSize = isMobile ? 22 : 54;
    const subTitleY = titleY + (isMobile ? 20 : 55);
    const subTitleSize = isMobile ? 12 : 18;

    this.add
      .text(width / 2, titleY, "✨ המסע לחתונה ✨", {
        fontFamily: "Arial",
        fontSize: `${titleSize}px`,
        fontStyle: "bold",
        color: "#ff66cc",
        rtl: true,
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, subTitleY, "הדרך לחתונה רצופה בכוונות טובות", {
        fontFamily: "Arial",
        fontSize: `${subTitleSize}px`,
        color: "#66ccff",
        rtl: true,
        align: "center",
      })
      .setOrigin(0.5);

    // במובייל תמיד 2x2 (שתי שורות) כדי שהתפריט לא ייחתך – כל 4 האפשרויות גלויות
    const cols = 2;
    const horizontalPadding = isMobile ? 16 : 0;
    const gap = isMobile ? 8 : 18;
    const cardW = Math.min(320, Math.floor((width - horizontalPadding * 2 - gap) / 2));

    const gridW = cols * cardW + (cols - 1) * gap;
    const startX = width / 2 - gridW / 2;
    const startY = isMobile ? subTitleY + 18 : 220;
    const bottomMargin = isMobile ? 28 : 0;
    const cardH = isMobile
      ? Math.max(70, Math.min(92, Math.floor((height - startY - bottomMargin - gap) / 2)))
      : 140;

    const startGame = (count: number) => {
      const mode: "solo" | "local" = count === 1 ? "solo" : "local";
      this.registry.set("playerCount", count);
      this.registry.set("mode", mode);

      if (count > 1) {
        this.scene.start("player-setup-scene", { mode, playerCount: count });
      } else {
        this.scene.start("network-scene", { mode, playerCount: count });
      }
    };

    PLAYER_OPTIONS.forEach((opt, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = startX + col * (cardW + gap) + cardW / 2;
      const y = startY + row * (cardH + gap) + cardH / 2;

      const bg = this.add
        .rectangle(0, 0, cardW, cardH, 0x16162a, 1)
        .setStrokeStyle(2, 0x2a2a44, 1);

      const compactCard = isMobile;
      const emojiY = compactCard ? -cardH / 2 + 10 : -cardH / 2 + 16;
      const labelY = compactCard ? -cardH / 2 + 12 : -cardH / 2 + 18;
      const descY = compactCard ? -cardH / 2 + 38 : -cardH / 2 + 48;
      const emoji = this.add
        .text(-cardW / 2 + 18, emojiY, opt.emoji, {
          fontFamily: "Arial",
          fontSize: isMobile ? (compactCard ? "22px" : "28px") : "32px",
          color: "#ffffff",
        })
        .setOrigin(0, 0);

      const label = this.add
        .text(-cardW / 2 + 68, labelY, opt.label, {
          fontFamily: "Arial",
          fontSize: isMobile ? (compactCard ? "15px" : "17px") : "18px",
          fontStyle: "bold",
          color: "#ffffff",
          rtl: true,
        })
        .setOrigin(0, 0);

      const desc = this.add
        .text(-cardW / 2 + 68, descY, opt.desc, {
          fontFamily: "Arial",
          fontSize: isMobile ? (compactCard ? "11px" : "13px") : "14px",
          color: "#b7b7c9",
          wordWrap: { width: cardW - 90 },
          rtl: true,
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
      });

      container.on("pointerup", () => {
        startGame(opt.count);
      });

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
  }

  private setSelected(count: number) {
    this.selected = count;

    for (const b of this.optionButtons) {
      const isSelected = b.opt.count === count;

      b.bg.setFillStyle(isSelected ? 0x201033 : 0x16162a, 1);
      b.bg.setStrokeStyle(2, isSelected ? 0xff66cc : 0x2a2a44, 1);

      b.container.setScale(isSelected ? 1.02 : 1);
    }

  }
}