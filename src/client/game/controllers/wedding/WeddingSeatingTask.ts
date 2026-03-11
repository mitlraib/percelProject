import Phaser from "phaser";
import WeddingSeatingCanon, {
  GuestDef,
  TableState,
} from "./WeddingSeatingCanon";

export type WeddingSeatingTaskResult =
  | { ok: true }
  | { ok: false; reason: "timeout" | "closed" | "invalid" };

type SeatView = {
  tableId: number;
  seatIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  zone: Phaser.GameObjects.Zone;
  bg: Phaser.GameObjects.Rectangle;
};

type GuestCardView = {
  guest: GuestDef;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  currentSeat: { tableId: number; seatIndex: number } | null;
  homeX: number;
  homeY: number;
};

type WeddingSeatingTaskOpts = {
  depth?: number;
  durationSec?: number;
  onComplete?: (result: WeddingSeatingTaskResult) => void;
};

export default class WeddingSeatingTask {
  private scene: Phaser.Scene;
  private canon: WeddingSeatingCanon;
  private opts: WeddingSeatingTaskOpts;

  private root!: Phaser.GameObjects.Container;
  private backdrop!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private rulesText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private submitBtn!: Phaser.GameObjects.Container;
  private closeBtn!: Phaser.GameObjects.Container;

  private seats: SeatView[] = [];
  private guestCards: GuestCardView[] = [];
  private tables: TableState[] = [];

  private timerEvent?: Phaser.Time.TimerEvent;
  private remainingSec = 60;
  private finished = false;

  private dropHandler?: (
    pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
    dropZone: Phaser.GameObjects.GameObject
  ) => void;

  // intro של אבא
  private introRoot?: Phaser.GameObjects.Container;
  private introBackdrop?: Phaser.GameObjects.Rectangle;
  private introPanel?: Phaser.GameObjects.Rectangle;
  private introDad?: Phaser.GameObjects.Image;
  private introTitle?: Phaser.GameObjects.Text;
  private introText?: Phaser.GameObjects.Text;
  private introStartBtn?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, opts: WeddingSeatingTaskOpts = {}) {
    this.scene = scene;
    this.opts = opts;
    this.canon = new WeddingSeatingCanon();
  }

  open() {
    this.openIntro();
  }

  private openIntro() {
    const depth = this.opts.depth ?? 5000;
    const { width, height } = this.scene.scale;

    this.introBackdrop = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);

    this.introPanel = this.scene.add
      .rectangle(
        width / 2,
        height / 2,
        Math.min(980, width * 0.9),
        Math.min(620, height * 0.86),
        0xfaf2e8,
        1
      )
      .setStrokeStyle(4, 0x4b2e2e)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    const dadKey =
      this.scene.textures.exists("DAD")
        ? "DAD"
        : this.scene.textures.exists("dad")
        ? "dad"
        : null;

    const introChildren: Phaser.GameObjects.GameObject[] = [];

    if (dadKey) {
      this.introDad = this.scene.add
        .image(width / 2, height / 2 - 70, dadKey)
        .setScrollFactor(0)
        .setDepth(depth + 2);

      const tex = this.introDad.texture.getSourceImage() as HTMLImageElement;
      const ratio = tex?.width && tex?.height ? tex.width / tex.height : 1;
      const targetH = Math.min(220, height * 0.28);
      this.introDad.setDisplaySize(targetH * ratio, targetH);

      introChildren.push(this.introDad);
    }

    this.introTitle = this.scene.add
      .text(width / 2, height / 2 + 85, "אבא", {
        fontFamily: "Arial",
        fontSize: "34px",
        color: "#3a1f1f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.introText = this.scene.add
      .text(
        width / 2,
        height / 2 + 145,
        "אוי! תכף החתונה ויש כזה בלאגן בשולחנות.\nתוכלי לעזור לי לסדר את האורחים בשולחנות?",
        {
          fontFamily: "Arial",
          fontSize: "28px",
          color: "#4a3a3a",
          align: "center",
          wordWrap: { width: Math.min(760, width * 0.72) },
          rtl: true,
        }
      )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.introStartBtn = this.createIntroButton(
      width / 2,
      height / 2 + this.introPanel.height / 2 - 55,
      220,
      60,
      "יאללה, מתחילים",
      0x6dbb75,
      () => this.startTaskFromIntro()
    ).setDepth(depth + 3);

    this.introRoot = this.scene.add
      .container(0, 0, [
        this.introPanel,
        ...introChildren,
        this.introTitle,
        this.introText,
        this.introStartBtn,
      ])
      .setScrollFactor(0)
      .setDepth(depth + 1);

    this.scene.tweens.add({
      targets: [this.introBackdrop, this.introRoot],
      alpha: { from: 0, to: 1 },
      duration: 180,
      ease: "Quad.easeOut",
    });
  }

  private createIntroButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    color: number,
    onClick: () => void
  ) {
    const bg = this.scene.add
      .rectangle(0, 0, w, h, color, 1)
      .setStrokeStyle(3, 0x3a2a2a)
      .setInteractive({ useHandCursor: true });

    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: "Arial",
        fontSize: "26px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const c = this.scene.add.container(x, y, [bg, label]).setScrollFactor(0);

    bg.on("pointerover", () => c.setScale(1.04));
    bg.on("pointerout", () => c.setScale(1));
    bg.on("pointerdown", onClick);

    return c;
  }

  private startTaskFromIntro() {
    if (!this.introRoot || !this.introBackdrop) {
      this.buildTaskUI();
      return;
    }

    this.scene.tweens.add({
      targets: [this.introBackdrop, this.introRoot],
      alpha: 0,
      duration: 180,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.introRoot?.destroy(true);
        this.introBackdrop?.destroy();

        this.introRoot = undefined;
        this.introBackdrop = undefined;
        this.introPanel = undefined;
        this.introDad = undefined;
        this.introTitle = undefined;
        this.introText = undefined;
        this.introStartBtn = undefined;

        this.buildTaskUI();
      },
    });
  }

  private buildTaskUI() {
    if (this.root) return;

    const depth = this.opts.depth ?? 5000;
    this.remainingSec = this.opts.durationSec ?? 60;
    this.tables = this.canon.createEmptyTables();
    this.seats = [];
    this.guestCards = [];
    this.finished = false;

    const { width, height } = this.scene.scale;

    this.backdrop = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);

    this.panel = this.scene.add
      .rectangle(
        width / 2,
        height / 2,
        Math.min(1120, width * 0.92),
        Math.min(720, height * 0.9),
        0xfaf2e8,
        1
      )
      .setStrokeStyle(4, 0x4b2e2e)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    this.titleText = this.scene.add
      .text(width / 2, height / 2 - this.panel.height / 2 + 28, "סידור שולחנות", {
        fontFamily: "Arial",
        fontSize: "34px",
        color: "#3a1f1f",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.rulesText = this.scene.add
      .text(width / 2, this.titleText.y + 52, this.buildRulesText(), {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#4a3a3a",
        align: "right",
        wordWrap: { width: Math.min(960, width * 0.82) },
        rtl: true,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.timerText = this.scene.add
      .text(width / 2 - 440, this.titleText.y + 8, `זמן: ${this.remainingSec}`, {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#8b1e3f",
        fontStyle: "bold",
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.statusText = this.scene.add
      .text(width / 2, this.panel.y + this.panel.height / 2 - 95, "גררי את האורחים לשולחנות", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#2d4a22",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.root = this.scene.add.container(0, 0).setDepth(depth + 1);
    this.root.setScrollFactor(0);

    this.createTables(depth + 2);
    this.createGuestCards(depth + 3);
    this.createButtons(depth + 3);
    this.registerDropHandler();

    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.finished) return;

        this.remainingSec -= 1;
        this.timerText.setText(`זמן: ${this.remainingSec}`);

        if (this.remainingSec <= 0) {
          this.finish({ ok: false, reason: "timeout" });
        }
      },
    });
  }

  destroy() {
    this.timerEvent?.remove(false);
    this.destroyInputHandlers();

    this.root?.destroy(true);
    this.backdrop?.destroy();
    this.panel?.destroy();
    this.titleText?.destroy();
    this.rulesText?.destroy();
    this.timerText?.destroy();
    this.statusText?.destroy();

    this.introRoot?.destroy(true);
    this.introBackdrop?.destroy();

    this.seats = [];
    this.guestCards = [];
  }

  private buildRulesText(): string {
    return [
      "חוקים:",
      "1. דודה רחל ודוד משה לא יכולים לשבת באותו שולחן",
      "2. יוסי ונועה חייבים לשבת יחד",
      "3. משפחה יושבת לפחות בזוגות",
      "4. חברים יושבים לפחות בזוגות",
    ].join("\n");
  }

  private createTables(depth: number) {
    const { width, height } = this.scene.scale;

    const areaTop = height / 2 - 40;
    const tableY = areaTop + 60;
    const tableGap = 300;
    const tableStartX = width / 2 - tableGap / 2;

    for (let t = 0; t < this.canon.tablesCount; t++) {
      const tableX = tableStartX + t * tableGap;

      const tableCircle = this.scene.add
        .ellipse(tableX, tableY, 220, 150, 0xe5d3b3, 1)
        .setStrokeStyle(4, 0x6a4e32)
        .setScrollFactor(0)
        .setDepth(depth);

      const tableLabel = this.scene.add
        .text(tableX, tableY - 95, `שולחן ${t + 1}`, {
          fontFamily: "Arial",
          fontSize: "24px",
          color: "#3d2b1f",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(depth);

      this.root.add([tableCircle, tableLabel]);

      const seatPositions = [
        { x: tableX - 80, y: tableY - 25 },
        { x: tableX + 0, y: tableY - 40 },
        { x: tableX + 80, y: tableY - 25 },
      ];

      for (let s = 0; s < this.canon.seatsPerTable; s++) {
        const pos = seatPositions[s];

        const bg = this.scene.add
          .rectangle(pos.x, pos.y, 110, 54, 0xffffff, 0.95)
          .setStrokeStyle(3, 0x8b7355)
          .setScrollFactor(0)
          .setDepth(depth + 1);

        const zone = this.scene.add
          .zone(pos.x, pos.y, 110, 54)
          .setRectangleDropZone(110, 54)
          .setScrollFactor(0)
          .setDepth(depth + 2);

        this.root.add([bg, zone]);

        this.seats.push({
          tableId: t,
          seatIndex: s,
          x: pos.x,
          y: pos.y,
          w: 110,
          h: 54,
          zone,
          bg,
        });
      }
    }

    const guestBankTitle = this.scene.add
      .text(width / 2, height / 2 + 165, "אורחים", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#3d2b1f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth);

    this.root.add(guestBankTitle);
  }

  private createGuestCards(depth: number) {
    const { width, height } = this.scene.scale;

    const guests = this.canon.guests;
    const cols = 3;
    const gapX = 210;
    const gapY = 78;
    const startX = width / 2 - gapX;
    const startY = height / 2 + 230;

    guests.forEach((guest, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      const x = startX + col * gapX;
      const y = startY + row * gapY;

      const bgColor =
        guest.group === "family"
          ? 0xffe6ea
          : guest.group === "friends"
          ? 0xe5f4ff
          : 0xf0f0f0;

      const bg = this.scene.add
        .rectangle(0, 0, 150, 52, bgColor, 1)
        .setStrokeStyle(3, 0x4b2e2e)
        .setInteractive({ useHandCursor: true });

      this.scene.input.setDraggable(bg);

      const label = this.scene.add
        .text(0, 0, guest.label, {
          fontFamily: "Arial",
          fontSize: "20px",
          color: "#2d2d2d",
          fontStyle: "bold",
          rtl: true,
        })
        .setOrigin(0.5);

      const container = this.scene.add
        .container(x, y, [bg, label])
        .setScrollFactor(0)
        .setDepth(depth);

      const card: GuestCardView = {
        guest,
        container,
        bg,
        label,
        currentSeat: null,
        homeX: x,
        homeY: y,
      };

      this.setupGuestDrag(card);
      this.root.add(container);
      this.guestCards.push(card);
    });
  }

  private setupGuestDrag(card: GuestCardView) {
    const inputBg = card.bg;

    inputBg.on("dragstart", () => {
      if (this.finished) return;

      card.container.setScale(1.08);
      card.container.setDepth(999999);
      this.highlightAllSeats(true);
    });

    inputBg.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (this.finished) return;
      card.container.x = dragX;
      card.container.y = dragY;
    });

    inputBg.on("dragend", (_pointer: Phaser.Input.Pointer, dropped: boolean) => {
      if (this.finished) return;

      card.container.setScale(1);
      this.highlightAllSeats(false);

      if (!dropped) {
        this.moveCardToSeatOrHome(card);
      }
    });
  }

  private registerDropHandler() {
    this.dropHandler = (
      _pointer: Phaser.Input.Pointer,
      gameObject: Phaser.GameObjects.GameObject,
      dropZone: Phaser.GameObjects.GameObject
    ) => {
      if (this.finished) return;

      const card = this.guestCards.find((c) => c.bg === gameObject);
      if (!card) return;

      const seat = this.seats.find((s) => s.zone === dropZone);
      if (!seat) {
        this.moveCardToSeatOrHome(card);
        return;
      }

      this.placeCardInSeat(card, seat.tableId, seat.seatIndex);
    };

    this.scene.input.on(Phaser.Input.Events.DROP, this.dropHandler, this);
  }

  private destroyInputHandlers() {
    if (this.dropHandler) {
      this.scene.input.off(Phaser.Input.Events.DROP, this.dropHandler, this);
      this.dropHandler = undefined;
    }
  }

  private placeCardInSeat(card: GuestCardView, tableId: number, seatIndex: number) {
    const seat = this.tables[tableId].seatGuestIds[seatIndex];

    if (seat && seat !== card.guest.id) {
      this.statusText.setColor("#8b1e3f");
      this.statusText.setText("המקום הזה כבר תפוס");
      this.moveCardToSeatOrHome(card);
      return;
    }

    this.removeGuestFromCurrentSeat(card);

    const existingCardOnSeat = this.guestCards.find(
      (c) => c.currentSeat?.tableId === tableId && c.currentSeat?.seatIndex === seatIndex
    );

    if (existingCardOnSeat && existingCardOnSeat !== card) {
      if (existingCardOnSeat.currentSeat) {
        const prev = existingCardOnSeat.currentSeat;
        this.tables[prev.tableId].seatGuestIds[prev.seatIndex] = null;
      }
      existingCardOnSeat.currentSeat = null;
      this.tweenCardTo(existingCardOnSeat, existingCardOnSeat.homeX, existingCardOnSeat.homeY);
    }

    this.tables[tableId].seatGuestIds[seatIndex] = card.guest.id;
    card.currentSeat = { tableId, seatIndex };

    const seatView = this.seats.find(
      (s) => s.tableId === tableId && s.seatIndex === seatIndex
    );

    if (!seatView) {
      this.statusText.setColor("#8b1e3f");
      this.statusText.setText("לא נמצא מושב מתאים");
      this.moveCardToSeatOrHome(card);
      return;
    }

    this.tweenCardTo(card, seatView.x, seatView.y);
    card.container.setDepth((this.opts.depth ?? 5000) + 3);

    this.statusText.setColor("#2d4a22");
    this.statusText.setText(`${card.guest.label} שובץ לשולחן ${tableId + 1}`);
  }

  private removeGuestFromCurrentSeat(card: GuestCardView) {
    if (!card.currentSeat) return;

    const { tableId, seatIndex } = card.currentSeat;
    if (this.tables[tableId].seatGuestIds[seatIndex] === card.guest.id) {
      this.tables[tableId].seatGuestIds[seatIndex] = null;
    }

    card.currentSeat = null;
  }

  private moveCardToSeatOrHome(card: GuestCardView) {
    if (card.currentSeat) {
      const seatView = this.seats.find(
        (s) =>
          s.tableId === card.currentSeat!.tableId &&
          s.seatIndex === card.currentSeat!.seatIndex
      );

      if (seatView) {
        this.tweenCardTo(card, seatView.x, seatView.y);
        return;
      }
    }

    this.tweenCardTo(card, card.homeX, card.homeY);
  }

  private tweenCardTo(card: GuestCardView, x: number, y: number) {
    this.scene.tweens.add({
      targets: card.container,
      x,
      y,
      duration: 180,
      ease: "Quad.easeOut",
    });
  }

  private highlightAllSeats(active: boolean) {
    for (const seat of this.seats) {
      seat.bg.setFillStyle(active ? 0xfff7cc : 0xffffff, 0.95);
    }
  }

  private createButtons(depth: number) {
    const { width, height } = this.scene.scale;
    const buttonY = height / 2 + this.panel.height / 2 - 20;

    this.submitBtn = this.createButton(
      width / 2 + 120,
      buttonY,
      180,
      54,
      "בדיקה",
      0x6dbb75,
      () => this.submit()
    ).setDepth(depth);

    this.closeBtn = this.createButton(
      width / 2 - 120,
      buttonY,
      180,
      54,
      "סגור",
      0xd97b7b,
      () => this.finish({ ok: false, reason: "closed" })
    ).setDepth(depth);

    this.root.add([this.submitBtn, this.closeBtn]);
  }

  private createButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const bg = this.scene.add
      .rectangle(0, 0, w, h, color, 1)
      .setStrokeStyle(3, 0x3a2a2a)
      .setInteractive({ useHandCursor: true });

    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const c = this.scene.add.container(x, y, [bg, label]).setScrollFactor(0);

    bg.on("pointerover", () => c.setScale(1.04));
    bg.on("pointerout", () => c.setScale(1));
    bg.on("pointerdown", () => {
      if (!this.finished) onClick();
    });

    return c;
  }

  private submit() {
    if (this.finished) return;

    const result = this.canon.validate(this.tables);

    if (!result.ok) {
      this.statusText.setColor("#8b1e3f");
      this.statusText.setText(result.message);
      return;
    }

    this.statusText.setColor("#1f6f3f");
    this.statusText.setText(result.message);

    this.scene.time.delayedCall(700, () => {
      this.finish({ ok: true });
    });
  }

  private finish(result: WeddingSeatingTaskResult) {
    if (this.finished) return;
    this.finished = true;

    this.timerEvent?.remove(false);
    this.destroyInputHandlers();

    this.scene.tweens.add({
      targets: [
        this.backdrop,
        this.panel,
        this.titleText,
        this.rulesText,
        this.timerText,
        this.statusText,
        this.root,
      ],
      alpha: 0,
      duration: 220,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.destroy();
        this.opts.onComplete?.(result);
      },
    });
  }
}