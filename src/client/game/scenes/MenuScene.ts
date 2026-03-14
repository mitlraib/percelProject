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

  private resizeHandler?: () => void;

  constructor() {
    super("menu-scene");
  }

  create() {
    this.buildMenu();

    this.resizeHandler = () => {
      this.scene.restart();
    };

    this.scale.on("resize", this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.resizeHandler) {
        this.scale.off("resize", this.resizeHandler);
      }
    });
  }

  private buildMenu() {
    this.selected = null;
    this.optionButtons = [];

    const { width, height } = this.scale;

    const isMobile = !!(this.sys.game.device.os.android || this.sys.game.device.os.iOS);
    const isPortrait = height > width;
    const isLandscape = isMobile && !isPortrait;
    const veryShortLandscape = isLandscape && height <= 380;
    const shortScreen = isMobile && height <= 500;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b14).setDepth(0);

    const titleY = veryShortLandscape ? 4 : isLandscape ? 6 : isMobile ? 10 : 90;
    const titleSize = veryShortLandscape ? 14 : isLandscape ? 16 : isMobile ? 18 : 54;

    const subTitleY = titleY + (veryShortLandscape ? 10 : isLandscape ? 12 : isMobile ? 14 : 55);
    const subTitleSize = veryShortLandscape ? 8 : isLandscape ? 9 : isMobile ? 10 : 18;

    this.add
      .text(width / 2, titleY, "✨ המסע לחתונה ✨", {
        fontFamily: "Arial",
        fontSize: `${titleSize}px`,
        fontStyle: "bold",
        color: "#ff66cc",
        rtl: true,
        align: "center",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, subTitleY, "הדרך לחתונה רצופה בכוונות טובות", {
        fontFamily: "Arial",
        fontSize: `${subTitleSize}px`,
        color: "#66ccff",
        rtl: true,
        align: "center",
      })
      .setOrigin(0.5, 0);

    const cols = 2;
    const rows = 2;

    const horizontalPadding = veryShortLandscape ? 8 : isLandscape ? 10 : isMobile ? 12 : 24;
    const gap = veryShortLandscape ? 6 : isMobile ? 8 : 18;

    const availableW = width - horizontalPadding * 2 - gap * (cols - 1);
    const maxCardW = veryShortLandscape ? 140 : isLandscape ? 155 : isMobile ? 200 : 320;
    const cardW = Math.min(maxCardW, Math.floor(availableW / cols));

    const gridW = cols * cardW + (cols - 1) * gap;
    const startX = width / 2 - gridW / 2;

    const startY = veryShortLandscape
      ? subTitleY + 8
      : isLandscape
      ? subTitleY + 10
      : shortScreen
      ? subTitleY + 12
      : isMobile
      ? subTitleY + 20
      : 220;

    const bottomMargin = veryShortLandscape ? 8 : isLandscape ? 10 : isMobile ? 14 : 40;
    const availableH = height - startY - bottomMargin - gap * (rows - 1);
    const cardH = isMobile
      ? Math.max(48, Math.min(veryShortLandscape ? 56 : isLandscape ? 64 : 90, Math.floor(availableH / rows)))
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
      const extraCompact = isLandscape;

      const emojiFontSize = veryShortLandscape
        ? "16px"
        : extraCompact
        ? "18px"
        : compactCard
        ? "22px"
        : "32px";

      const labelFontSize = veryShortLandscape
        ? "11px"
        : extraCompact
        ? "12px"
        : compactCard
        ? "15px"
        : "18px";

      const descFontSize = veryShortLandscape
        ? "8px"
        : extraCompact
        ? "9px"
        : compactCard
        ? "11px"
        : "14px";

      const leftPad = veryShortLandscape ? 10 : extraCompact ? 12 : 18;
      const textStartX = veryShortLandscape ? 44 : extraCompact ? 52 : 68;

      const emojiY = veryShortLandscape
        ? -cardH / 2 + 5
        : extraCompact
        ? -cardH / 2 + 6
        : compactCard
        ? -cardH / 2 + 10
        : -cardH / 2 + 16;

      const labelY = veryShortLandscape
        ? -cardH / 2 + 7
        : extraCompact
        ? -cardH / 2 + 8
        : compactCard
        ? -cardH / 2 + 12
        : -cardH / 2 + 18;

      const descY = veryShortLandscape
        ? -cardH / 2 + 24
        : extraCompact
        ? -cardH / 2 + 28
        : compactCard
        ? -cardH / 2 + 38
        : -cardH / 2 + 48;

      const emoji = this.add
        .text(-cardW / 2 + leftPad, emojiY, opt.emoji, {
          fontFamily: "Arial",
          fontSize: emojiFontSize,
          color: "#ffffff",
        })
        .setOrigin(0, 0);

      const label = this.add
        .text(-cardW / 2 + textStartX, labelY, opt.label, {
          fontFamily: "Arial",
          fontSize: labelFontSize,
          fontStyle: "bold",
          color: "#ffffff",
          rtl: true,
          wordWrap: { width: cardW - textStartX - 8 },
        })
        .setOrigin(0, 0);

      const desc = this.add
        .text(-cardW / 2 + textStartX, descY, opt.desc, {
          fontFamily: "Arial",
          fontSize: descFontSize,
          color: "#b7b7c9",
          rtl: true,
          wordWrap: { width: cardW - textStartX - 8 },
        })
        .setOrigin(0, 0);

      const container = this.add.container(x, y, [bg, emoji, label, desc]).setDepth(2);

      container.setSize(cardW, cardH);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
        Phaser.Geom.Rectangle.Contains
      );

      container.on("pointerover", () => {
        if (this.selected !== opt.count) {
          bg.setStrokeStyle(2, 0xff66cc, 0.5);
        }
        this.input.setDefaultCursor("pointer");
      });

      container.on("pointerout", () => {
        if (this.selected !== opt.count) {
          bg.setStrokeStyle(2, 0x2a2a44, 1);
        }
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