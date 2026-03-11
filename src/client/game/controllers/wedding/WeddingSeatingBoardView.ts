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
        height / 2 - 10,
        Math.min(980, width * 0.88),
        Math.min(620, height * 0.86),
        0xfaf2e8,
        1
      )
      .setStrokeStyle(4, 0x4b2e2e)
      .setScrollFactor(0)
      .setDepth(this.depth + 1);

    const panelTop = panel.y - panel.height / 2;

    const titleText = this.scene.add
      .text(width / 2, panelTop + 18, "סידור שולחנות", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#3a1f1f",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 2);

    const rulesText = this.scene.add
      .text(width / 2, panelTop + 64, this.buildRulesText(), {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#4a3a3a",
        align: "center",
        wordWrap: { width: Math.min(760, width * 0.7) },
        rtl: true,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 2);

    const timerText = this.scene.add
      .text(width * 0.12, panelTop + 14, `זמן: ${this.durationSec}`, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#8b1e3f",
        fontStyle: "bold",
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 2);

    const statusText = this.scene.add
      .text(width / 2, panel.y + panel.height / 2 - 78, "גררי את האורחים לשולחנות", {
        fontFamily: "Arial",
        fontSize: "16px",
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
    return [
      "חוקים:",
      "1. דודה רחל ודוד משה לא יכולים לשבת באותו שולחן",
      "2. יוסי ונועה חייבים לשבת יחד",
    ].join("\n");
  }

  private createTables(
    root: Phaser.GameObjects.Container,
    panel: Phaser.GameObjects.Rectangle,
    depth: number
  ): SeatView[] {
    const { width } = this.scene.scale;
    const seats: SeatView[] = [];

    const tableY = panel.y + 20;
    const tableGap = 240;
    const tableStartX = width / 2 - tableGap / 2;

    for (let t = 0; t < this.canon.tablesCount; t++) {
      const tableX = tableStartX + t * tableGap;

      const tableCircle = this.scene.add
        .ellipse(tableX, tableY, 150, 102, 0xe5d3b3, 1)
        .setStrokeStyle(3, 0x6a4e32)
        .setScrollFactor(0)
        .setDepth(depth);

      const tableLabel = this.scene.add
        .text(tableX, tableY - 72, `שולחן ${t + 1}`, {
          fontFamily: "Arial",
          fontSize: "18px",
          color: "#3d2b1f",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(depth + 1);

      root.add([tableCircle, tableLabel]);

      const seatPositions = [
        { x: tableX - 52, y: tableY - 14 },
        { x: tableX, y: tableY - 24 },
        { x: tableX + 52, y: tableY - 14 },
      ];

      for (let s = 0; s < this.canon.seatsPerTable; s++) {
        const pos = seatPositions[s];

        const bg = this.scene.add
          .rectangle(pos.x, pos.y, 76, 36, 0xffffff, 0.96)
          .setStrokeStyle(2, 0x8b7355)
          .setScrollFactor(0)
          .setDepth(depth + 1);

        const zone = this.scene.add
          .zone(pos.x, pos.y, 92, 52)
          .setRectangleDropZone(92, 52)
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
    const buttonY = panel.y + panel.height / 2 - 34;

    const submitBtnBg = this.scene.add
      .rectangle(panel.x, buttonY, 150, 44, 0x6dbb75, 1)
      .setStrokeStyle(2, 0x3a2a2a)
      .setScrollFactor(0)
      .setDepth(depth + 100)
      .setInteractive({ useHandCursor: true });

    const submitBtnLabel = this.scene.add
      .text(panel.x, buttonY, "בדיקה", {
        fontFamily: "Arial",
        fontSize: "18px",
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