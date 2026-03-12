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

  build(onSubmit: () => void): WeddingBoardRefs {
    const { width, height } = this.scene.scale;

    const backdrop = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(this.depth);

    const panel = this.scene.add
      .rectangle(
        width / 2,
        height / 2 - 6,
        Math.min(1040, width * 0.92),
        Math.min(660, height * 0.9),
        0xfaf2e8,
        1
      )
      .setStrokeStyle(4, 0x4b2e2e)
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    const panelTop = panel.y - panel.height / 2;

    const titleText = this.scene.add
      .text(width / 2, panelTop + 16, "סידור שולחנות", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#3a1f1f",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 2);

    const rulesText = this.scene.add
      .text(width / 2, panelTop + 52, this.buildRulesText(), {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#4a3a3a",
        align: "center",
        wordWrap: { width: Math.min(760, panel.width * 0.74) },
        rtl: true,
      })
      .setOrigin(0.5, 0)
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

    const statusText = this.scene.add
      .text(width / 2, panel.y + panel.height / 2 - 72, "גררי את האורחים לשולחנות", {
        fontFamily: "Arial",
        fontSize: "15px",
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
    const lines = this.canon.rules.map((rule, index) => `${index + 1}. ${rule.reason.replace("❌ ", "")}`);
    return ["חוקים:", ...lines].join("\n");
  }

  private createTables(
    root: Phaser.GameObjects.Container,
    panel: Phaser.GameObjects.Rectangle,
    depth: number
  ): SeatView[] {
    const seats: SeatView[] = [];

    const cols = Math.min(2, this.canon.tablesCount);
    const rows = Math.ceil(this.canon.tablesCount / cols);

    const gridCenterX = panel.x;
    const gridCenterY = panel.y + 20;

    const gapX = 180;
    const gapY = 145;

    const startX = gridCenterX - ((cols - 1) * gapX) / 2;
    const startY = gridCenterY - ((rows - 1) * gapY) / 2;

    for (let t = 0; t < this.canon.tablesCount; t++) {
      const col = t % cols;
      const row = Math.floor(t / cols);

      const tableX = startX + col * gapX;
      const tableY = startY + row * gapY;

      const tableCircle = this.scene.add
        .ellipse(tableX, tableY, 112, 78, 0xe5d3b3, 1)
        .setStrokeStyle(3, 0x6a4e32)
        .setScrollFactor(0)
        .setDepth(depth);

      const tableLabel = this.scene.add
        .text(tableX, tableY - 54, `שולחן ${t + 1}`, {
          fontFamily: "Arial",
          fontSize: "15px",
          color: "#3d2b1f",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(depth + 1);

      root.add([tableCircle, tableLabel]);

      const seatPositions = [
        { x: tableX - 36, y: tableY - 8 },
        { x: tableX, y: tableY - 18 },
        { x: tableX + 36, y: tableY - 8 },
      ];

      for (let s = 0; s < this.canon.seatsPerTable; s++) {
        const pos = seatPositions[s];

        const bg = this.scene.add
          .rectangle(pos.x, pos.y, 58, 28, 0xffffff, 0.96)
          .setStrokeStyle(2, 0x8b7355)
          .setScrollFactor(0)
          .setDepth(depth + 1);

        const zone = this.scene.add
          .zone(pos.x, pos.y, 72, 40)
          .setRectangleDropZone(72, 40)
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