import Phaser from "phaser";
import WeddingSeatingCanon from "./WeddingSeatingCanon";
import type { SeatView, WeddingBoardRefs } from "./WeddingSeatingTypes";

export default class WeddingSeatingBoardView {
  private scene: Phaser.Scene;
  private canon: WeddingSeatingCanon;
  private depth: number;
  private durationSec: number;

  constructor(
    scene: Phaser.Scene,
    canon: WeddingSeatingCanon,
    depth: number,
    durationSec: number
  ) {
    this.scene = scene;
    this.canon = canon;
    this.depth = depth;
    this.durationSec = durationSec;
  }

  private isMobile(): boolean {
    const device = (this.scene as Phaser.Scene & { sys: { game: { device?: { os?: { android?: boolean; iOS?: boolean } } } } }).sys?.game?.device;
    return !!(device?.os?.android || device?.os?.iOS);
  }

  build(onSubmit: () => void): WeddingBoardRefs {
    const { width, height } = this.scene.scale;
    const mobile = this.isMobile();

    const backdrop = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(this.depth);

    const panelW = mobile ? Math.min(width * 0.96, 420) : Math.min(1040, width * 0.92);
    const panelH = mobile ? Math.min(height * 0.88, 520) : Math.min(660, height * 0.9);
    const panel = this.scene.add
      .rectangle(
        width / 2,
        height / 2 - (mobile ? 0 : 6),
        panelW,
        panelH,
        0xfaf2e8,
        1
      )
      .setStrokeStyle(4, 0x4b2e2e)
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    const panelTop = panel.y - panel.height / 2;
    const titleY = mobile ? panelTop + 10 : panelTop + 16;
    const titleText = this.scene.add
      .text(width / 2, titleY, "סידור שולחנות", {
        fontFamily: "Arial",
        fontSize: mobile ? "18px" : "22px",
        color: "#3a1f1f",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 2);

    const rulesX = mobile ? panel.x + panel.width / 2 + 2 : width / 2;
    const rulesY = mobile ? panelTop + 4 : panelTop + 52;
    const rulesWrap = mobile ? Math.min(185, panel.width * 0.42) : Math.min(760, panel.width * 0.74);
    const rulesText = this.scene.add
      .text(rulesX, rulesY, this.buildRulesText(), {
        fontFamily: "Arial",
        fontSize: mobile ? "11px" : "17px",
        fontStyle: mobile ? "normal" : "bold",
        color: mobile ? "#4a3a3a" : "#2d1f1f",
        align: mobile ? "right" : "center",
        wordWrap: { width: rulesWrap },
        rtl: true,
      })
      .setOrigin(mobile ? 1 : 0.5, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 2);

    const timerText = this.scene.add
      .text(panel.x - panel.width / 2 + 22, panelTop + 14, `זמן: ${this.durationSec}`, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#8b1e3f",
        fontStyle: "bold",
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 2);

    const statusY = panel.y + panel.height / 2 - (mobile ? 56 : 72);
    const statusText = this.scene.add
      .text(width / 2, statusY, "גררי את האורחים לשולחנות", {
        fontFamily: "Arial",
        fontSize: mobile ? "13px" : "15px",
        color: "#2d4a22",
        fontStyle: "bold",
        align: "center",
        rtl: true,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(this.depth + 2);

    const root = this.scene.add.container(0, 0).setDepth(this.depth + 1);
    root.setScrollFactor(0);

    const seats = this.createTables(root, panel, this.depth + 2);
    const { submitBtnBg, submitBtnLabel } = this.createButtons(panel, onSubmit, this.depth + 20);

    return {
      root,
      backdrop,
      panel,
      titleText,
      rulesText,
      timerText,
      statusText,
      submitBtnBg,
      submitBtnLabel,
      seats,
    };
  }

  private buildRulesText(): string {
    const lines = this.canon.rules.map(
      (rule, index) => `${index + 1}. ${rule.reason.replace("❌ ", "")}`
    );
    return ["חוקים:", ...lines].join("\n");
  }

  private createTables(
    root: Phaser.GameObjects.Container,
    panel: Phaser.GameObjects.Rectangle,
    depth: number
  ): SeatView[] {
    const seats: SeatView[] = [];
    const mobile = this.isMobile();

    const cols = Math.min(2, this.canon.tablesCount);
    const rows = Math.ceil(this.canon.tablesCount / cols);

    const gridCenterX = mobile ? panel.x - 56 : panel.x;
    const gridCenterY = mobile ? panel.y + 130 : panel.y + 20;

    const gapX = mobile ? 140 : 180;
    const gapY = mobile ? 118 : 145;

    const startX = gridCenterX - ((cols - 1) * gapX) / 2;
    const startY = gridCenterY - ((rows - 1) * gapY) / 2;

    const tableW = mobile ? 96 : 112;
    const tableH = mobile ? 66 : 78;
    const seatW = mobile ? 46 : 54;
    const seatH = mobile ? 22 : 26;
    const seatZoneW = mobile ? 54 : 62;
    const seatZoneH = mobile ? 30 : 34;
    const labelOffset = mobile ? -46 : -54;

    for (let t = 0; t < this.canon.tablesCount; t++) {
      const col = t % cols;
      const row = Math.floor(t / cols);

      const tableX = startX + col * gapX;
      const tableY = startY + row * gapY;

      const tableCircle = this.scene.add
        .ellipse(tableX, tableY, tableW, tableH, 0xe5d3b3, 1)
        .setStrokeStyle(3, 0x6a4e32)
        .setScrollFactor(0)
        .setDepth(depth);

      const tableLabel = this.scene.add
        .text(tableX, tableY + labelOffset, `שולחן ${t + 1}`, {
          fontFamily: "Arial",
          fontSize: mobile ? "13px" : "15px",
          color: "#3d2b1f",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(depth + 1);

      root.add([tableCircle, tableLabel]);

      const seatPositions = [
        { x: tableX - (mobile ? 40 : 48), y: tableY - (mobile ? 6 : 8) },
        { x: tableX, y: tableY - (mobile ? 16 : 20) },
        { x: tableX + (mobile ? 40 : 48), y: tableY - (mobile ? 6 : 8) },
      ];

      for (let s = 0; s < this.canon.seatsPerTable; s++) {
        const pos = seatPositions[s];

        const bg = this.scene.add
          .rectangle(pos.x, pos.y, seatW, seatH, 0xffffff, 0.96)
          .setStrokeStyle(2, 0x8b7355)
          .setScrollFactor(0)
          .setDepth(depth + 1);

        const zone = this.scene.add
          .zone(pos.x, pos.y, seatZoneW, seatZoneH)
          .setRectangleDropZone(seatZoneW, seatZoneH)
          .setScrollFactor(0)
          .setDepth(depth + 2);

        root.add([bg, zone]);

        seats.push({
          tableId: t,
          seatIndex: s,
          x: pos.x,
          y: pos.y,
          zone,
          bg,
        });
      }
    }

    return seats;
  }

  private createButtons(
    panel: Phaser.GameObjects.Rectangle,
    onSubmit: () => void,
    depth: number
  ) {
    const buttonY = panel.y + panel.height / 2 - 32;

    const submitBtnBg = this.scene.add
      .rectangle(panel.x, buttonY, 132, 40, 0x6dbb75, 1)
      .setStrokeStyle(2, 0x3a2a2a)
      .setScrollFactor(0)
      .setDepth(depth + 100)
      .setInteractive({ useHandCursor: true });

    const submitBtnLabel = this.scene.add
      .text(panel.x, buttonY, "בדיקה", {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 101);

    submitBtnBg.on("pointerover", () => {
      submitBtnBg.setScale(1.04);
      submitBtnLabel.setScale(1.04);
    });

    submitBtnBg.on("pointerout", () => {
      submitBtnBg.setScale(1);
      submitBtnLabel.setScale(1);
    });

    submitBtnBg.on("pointerdown", onSubmit);

    return { submitBtnBg, submitBtnLabel };
  }
}