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
    const isLandscape = isMobile && width > height;
    const veryShortLandscape = isLandscape && height <= 430;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b14).setDepth(0);

    const root = this.add.container(width / 2, 0).setDepth(2);

    const titleSize = veryShortLandscape ? 15 : isLandscape ? 18 : isMobile ? 22 : 54;
    const subTitleSize = veryShortLandscape ? 9 : isLandscape ? 10 : isMobile ? 12 : 18;

    const title = this.add
      .text(0, 0, "✨ המסע לחתונה ✨", {
        fontFamily: "Arial",
        fontSize: `${titleSize}px`,
        fontStyle: "bold",
        color: "#ff66cc",
        rtl: true,
        align: "center",
      })
      .setOrigin(0.5, 0);

    const subtitle = this.add
      .text(0, title.height + (veryShortLandscape ? 2 : 6), "הדרך לחתונה רצופה בכוונות טובות", {
        fontFamily: "Arial",
        fontSize: `${subTitleSize}px`,
        color: "#66ccff",
        rtl: true,
        align: "center",
      })
      .setOrigin(0.5, 0);

    root.add([title, subtitle]);

    const cols = 2;
    const gap = veryShortLandscape ? 8 : isMobile ? 10 : 18;
    const horizontalPadding = veryShortLandscape ? 10 : isMobile ? 16 : 24;

    const availableW = width - horizontalPadding * 2 - gap;
    const maxCardW = veryShortLandscape ? 170 : isLandscape ? 185 : 320;
    const cardW = Math.min(maxCardW, Math.floor(availableW / cols));

    const rows = 2;
    const topForGrid = subtitle.y + subtitle.height + (veryShortLandscape ? 10 : isLandscape ? 14 : 28);

    const bottomSafe = veryShortLandscape ? 12 : 20;
    const availableH = height - topForGrid - bottomSafe - gap * (rows - 1);

    const cardH = isMobile
      ? Math.max(
          veryShortLandscape ? 50 : isLandscape ? 60 : 78,
          Math.min(
            veryShortLandscape ? 64 : isLandscape ? 76 : 100,
            Math.floor(availableH / rows)
          )
        )
      : 140;

    const gridW = cols * cardW + gap;
    const gridStartX = -gridW / 2;
    const gridStartY = topForGrid;

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

      const x = gridStartX + col * (cardW + gap) + cardW / 2;
      const y = gridStartY + row * (cardH + gap) + cardH / 2;

      const bg = this.add
        .rectangle(0, 0, cardW, cardH, 0x16162a, 1)
        .setStrokeStyle(2, 0x2a2a44, 1);

      const emojiFontSize = veryShortLandscape ? "15px" : isLandscape ? "18px" : isMobile ? "22px" : "32px";
      const labelFontSize = veryShortLandscape ? "10px" : isLandscape ? "12px" : isMobile ? "15px" : "18px";
      const descFontSize = veryShortLandscape ? "8px" : isLandscape ? "9px" : isMobile ? "11px" : "14px";

      const leftPad = veryShortLandscape ? 8 : isLandscape ? 12 : 18;
      const textStartX = veryShortLandscape ? 40 : isLandscape ? 52 : 68;

      const emoji = this.add
        .text(-cardW / 2 + leftPad, -cardH / 2 + (veryShortLandscape ? 5 : 6), opt.emoji, {
          fontFamily: "Arial",
          fontSize: emojiFontSize,
          color: "#ffffff",
        })
        .setOrigin(0, 0);

      const label = this.add
        .text(-cardW / 2 + textStartX, -cardH / 2 + (veryShortLandscape ? 7 : 8), opt.label, {
          fontFamily: "Arial",
          fontSize: labelFontSize,
          fontStyle: "bold",
          color: "#ffffff",
          rtl: true,
          wordWrap: { width: cardW - textStartX - 8 },
        })
        .setOrigin(0, 0);

      const desc = this.add
        .text(-cardW / 2 + textStartX, -cardH / 2 + (veryShortLandscape ? 22 : 28), opt.desc, {
          fontFamily: "Arial",
          fontSize: descFontSize,
          color: "#b7b7c9",
          rtl: true,
          wordWrap: { width: cardW - textStartX - 8 },
        })
        .setOrigin(0, 0);

      const container = this.add.container(x, y, [bg, emoji, label, desc]);
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
      container.y += 16;

      this.tweens.add({
        targets: container,
        alpha: 1,
        y: container.y - 16,
        duration: 300,
        delay: 120 + i * 70,
        ease: "Sine.out",
      });

      root.add(container);
      this.optionButtons.push({ opt, container, bg });
    });

    const bounds = root.getBounds();
    const safeTop = veryShortLandscape ? 6 : isLandscape ? 8 : isMobile ? 14 : 40;
    const safeBottom = veryShortLandscape ? 8 : 16;
    const maxAllowedHeight = height - safeTop - safeBottom;

    let scale = 1;
    if (bounds.height > maxAllowedHeight) {
      scale = Math.min(1, maxAllowedHeight / bounds.height);
    }

    root.setScale(scale);

    const scaledBounds = root.getBounds();
    root.x = width / 2;
    root.y = Math.max(safeTop, (height - scaledBounds.height) / 2);
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