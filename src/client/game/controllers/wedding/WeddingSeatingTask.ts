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

  private introBackdrop?: Phaser.GameObjects.Rectangle;
  private introDad?: Phaser.GameObjects.Image;
  private introBubble?: Phaser.GameObjects.Container;
  private introTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, opts: WeddingSeatingTaskOpts = {}) {
    this.scene = scene;
    this.opts = opts;
    this.canon = new WeddingSeatingCanon();
  }

  open() {
    this.openDadIntro();
  }

  private openDadIntro() {
    const depth = this.opts.depth ?? 5000;
    const { width, height } = this.scene.scale;

    this.introBackdrop = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.3)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);

    const dadKey = this.scene.textures.exists("DAD")
      ? "DAD"
      : this.scene.textures.exists("dad")
      ? "dad"
      : null;

    if (dadKey) {
      this.introDad = this.scene.add
        .image(width * 0.22, height * 0.64, dadKey)
        .setScrollFactor(0)
        .setDepth(depth + 2);

      const tex = this.introDad.texture.getSourceImage() as HTMLImageElement;
      const ratio = tex?.width && tex?.height ? tex.width / tex.height : 1;
      const targetH = Math.min(180, height * 0.24);
      this.introDad.setDisplaySize(targetH * ratio, targetH);
    }

    this.introBubble = this.createSpeechBubble(
      width * 0.5,
      height * 0.45,
      Math.min(520, width * 0.48),
      96,
      "אוי! תכף החתונה ויש כזה בלאגן בשולחנות.\nתוכלי לעזור לי לסדר את האורחים בשולחנות?",
      depth + 3
    );

    const introTargets: Phaser.GameObjects.GameObject[] = [];
    if (this.introBackdrop) introTargets.push(this.introBackdrop);
    if (this.introDad) introTargets.push(this.introDad);
    if (this.introBubble) introTargets.push(this.introBubble);

    for (const target of introTargets) {
      (target as any).setAlpha(0);
    }

    this.scene.tweens.add({
      targets: introTargets,
      alpha: 1,
      duration: 180,
      ease: "Sine.easeOut",
    });

    this.introTimer = this.scene.time.delayedCall(2000, () => {
      this.hideDadIntroAndStartTask();
    });
  }

  private createSpeechBubble(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    depth: number
  ): Phaser.GameObjects.Container {
    const bg = this.scene.add
      .rectangle(0, 0, w, h, 0xffffff, 0.98)
      .setStrokeStyle(3, 0x4b2e2e);

    const tail = this.scene.add
      .triangle(-(w / 2) + 28, h / 2 - 4, 0, 0, 18, 0, 5, 16, 0xffffff, 0.98)
      .setStrokeStyle(2, 0x4b2e2e);

    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#3a1f1f",
        align: "center",
        wordWrap: { width: w - 30 },
        rtl: true,
      })
      .setOrigin(0.5);

    return this.scene.add
      .container(x, y, [bg, tail, label])
      .setScrollFactor(0)
      .setDepth(depth);
  }

  private hideDadIntroAndStartTask() {
    const targets: Phaser.GameObjects.GameObject[] = [];
    if (this.introBackdrop) targets.push(this.introBackdrop);
    if (this.introDad) targets.push(this.introDad);
    if (this.introBubble) targets.push(this.introBubble);

    if (targets.length === 0) {
      this.buildTaskUI();
      return;
    }

    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 180,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.introBackdrop?.destroy();
        this.introDad?.destroy();
        this.introBubble?.destroy();

        this.introBackdrop = undefined;
        this.introDad = undefined;
        this.introBubble = undefined;

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
      .rectangle(0, 0, width, height, 0x000000, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);

    this.panel = this.scene.add
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
      .setDepth(depth + 1);

    const panelTop = this.panel.y - this.panel.height / 2;

    this.titleText = this.scene.add
      .text(width / 2, panelTop + 18, "סידור שולחנות", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#3a1f1f",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.rulesText = this.scene.add
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
      .setDepth(depth + 2);

    this.timerText = this.scene.add
      .text(width * 0.12, panelTop + 14, `זמן: ${this.remainingSec}`, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#8b1e3f",
        fontStyle: "bold",
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.statusText = this.scene.add
      .text(width / 2, this.panel.y + this.panel.height / 2 - 78, "גררי את האורחים לשולחנות", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#2d4a22",
        fontStyle: "bold",
        align: "center",
        rtl: true,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.root = this.scene.add.container(0, 0).setDepth(depth + 1);
    this.root.setScrollFactor(0);

    this.createTables(depth + 2);
    this.createGuestCards(depth + 3);
    this.createButtons(depth + 20);
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
    this.introTimer?.remove(false);
    this.destroyInputHandlers();

    this.root?.destroy(true);
    this.backdrop?.destroy();
    this.panel?.destroy();
    this.titleText?.destroy();
    this.rulesText?.destroy();
    this.timerText?.destroy();
    this.statusText?.destroy();

    this.introBackdrop?.destroy();
    this.introDad?.destroy();
    this.introBubble?.destroy();

    this.seats = [];
    this.guestCards = [];
  }

  private buildRulesText(): string {
    return [
      "חוקים:",
      "1. דודה רחל ודוד משה לא יכולים לשבת באותו שולחן",
      "2. יוסי ונועה חייבים לשבת יחד",
    ].join("\n");
  }

  private createTables(depth: number) {
    const { width } = this.scene.scale;

    const tableY = this.panel.y + 20;
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

      this.root.add([tableCircle, tableLabel]);

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

        this.root.add([bg, zone]);

        this.seats.push({
          tableId: t,
          seatIndex: s,
          x: pos.x,
          y: pos.y,
          w: 92,
          h: 52,
          zone,
          bg,
        });
      }
    }
  }

  private createGuestCards(depth: number) {
    const guests = this.canon.guests;
    const cardW = 112;
    const cardH = 36;
    const hitW = 150;
    const hitH = 56;

    const leftX = this.panel.x - 285;
    const rightX = this.panel.x + 285;
    const startY = this.panel.y - 20;
    const gapY = 62;

    guests.forEach((guest, index) => {
      const isLeft = index < 3;
      const sideIndex = isLeft ? index : index - 3;

      const x = isLeft ? leftX : rightX;
      const y = startY + sideIndex * gapY;

      const bgColor =
        guest.group === "family"
          ? 0xffe6ea
          : guest.group === "friends"
          ? 0xe5f4ff
          : 0xf0f0f0;

      const bg = this.scene.add
        .rectangle(0, 0, cardW, cardH, bgColor, 1)
        .setStrokeStyle(2, 0x4b2e2e);

      const label = this.scene.add
        .text(0, 0, guest.label, {
          fontFamily: "Arial",
          fontSize: "14px",
          color: "#2d2d2d",
          fontStyle: "bold",
          rtl: true,
        })
        .setOrigin(0.5);

      const container = this.scene.add
        .container(x, y, [bg, label])
        .setScrollFactor(0)
        .setDepth(depth)
        .setSize(hitW, hitH)
        .setInteractive(
          new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
          Phaser.Geom.Rectangle.Contains
        );

      this.scene.input.setDraggable(container);

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
    const dragTarget = card.container;

    dragTarget.on("dragstart", () => {
      if (this.finished) return;

      dragTarget.setScale(1.08);
      dragTarget.setDepth(999999);
      this.highlightAllSeats(true);
    });

    dragTarget.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (this.finished) return;
      dragTarget.x = dragX;
      dragTarget.y = dragY;
    });

    dragTarget.on("dragend", (_pointer: Phaser.Input.Pointer, dropped: boolean) => {
      if (this.finished) return;

      dragTarget.setScale(1);
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

      const card = this.guestCards.find((c) => c.container === gameObject);
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
      this.statusText.setColor("#b00020");
      this.statusText.setText("❌ המקום הזה כבר תפוס");
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
      this.statusText.setColor("#b00020");
      this.statusText.setText("❌ לא נמצא מושב מתאים");
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
      duration: 170,
      ease: "Quad.easeOut",
    });
  }

  private highlightAllSeats(active: boolean) {
    for (const seat of this.seats) {
      seat.bg.setFillStyle(active ? 0xfff7cc : 0xffffff, 0.96);
    }
  }

  private createButtons(depth: number) {
    const buttonY = this.panel.y + this.panel.height / 2 - 34;

    this.submitBtn = this.createButton(
      this.panel.x,
      buttonY,
      150,
      44,
      "בדיקה",
      0x6dbb75,
      () => this.submit()
    ).setDepth(depth);

    this.root.add(this.submitBtn);
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
      .setStrokeStyle(2, 0x3a2a2a);

    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const hit = this.scene.add
      .rectangle(0, 0, w, h, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });

    const c = this.scene.add
      .container(x, y, [bg, label, hit])
      .setScrollFactor(0)
      .setDepth(30000);

    hit.on("pointerover", () => c.setScale(1.04));
    hit.on("pointerout", () => c.setScale(1));
    hit.on("pointerdown", () => {
      if (!this.finished) onClick();
    });

    return c;
  }

  private submit() {
    if (this.finished) return;

    const result = this.canon.validate(this.tables);

    if (!result.ok) {
      this.statusText.setColor("#b00020");
      this.statusText.setText(result.message);

      this.scene.tweens.add({
        targets: this.statusText,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 90,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
      });

      this.scene.tweens.add({
        targets: this.panel,
        x: this.panel.x + 6,
        duration: 45,
        yoyo: true,
        repeat: 3,
        ease: "Sine.easeInOut",
        onComplete: () => {
          this.panel.x = this.scene.scale.width / 2;
        },
      });

      return;
    }

    this.statusText.setColor("#1f6f3f");
    this.statusText.setText(result.message);

    this.scene.time.delayedCall(600, () => {
      this.finish({ ok: true });
    });
  }

  private finish(result: WeddingSeatingTaskResult) {
    if (this.finished) return;
    this.finished = true;

    this.timerEvent?.remove(false);
    this.introTimer?.remove(false);
    this.destroyInputHandlers();

    const targets: Phaser.GameObjects.GameObject[] = [
      this.backdrop,
      this.panel,
      this.titleText,
      this.rulesText,
      this.timerText,
      this.statusText,
      this.root,
    ].filter(Boolean) as Phaser.GameObjects.GameObject[];

    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 200,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.destroy();
        this.opts.onComplete?.(result);
      },
    });
  }
}