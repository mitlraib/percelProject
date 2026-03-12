import Phaser from "phaser";
import WeddingSeatingCanon, { TableState } from "./WeddingSeatingCanon";
import type { GuestCardView, SeatView } from "./WeddingSeatingTypes";

type GuestsControllerOpts = {
  depth: number;
  root: Phaser.GameObjects.Container;
  seats: SeatView[];
  tables: TableState[];
  statusText: Phaser.GameObjects.Text;
  finished: () => boolean;
};

type GuestCardWithDragZone = GuestCardView & {
  dragZone: Phaser.GameObjects.Zone;
};

export default class WeddingSeatingGuestsController {
  private scene: Phaser.Scene;
  private canon: WeddingSeatingCanon;
  private opts: GuestsControllerOpts;

  private guestCards: GuestCardWithDragZone[] = [];
  private dropHandler?: (
    pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
    dropZone: Phaser.GameObjects.GameObject
  ) => void;

  constructor(scene: Phaser.Scene, canon: WeddingSeatingCanon, opts: GuestsControllerOpts) {
    this.scene = scene;
    this.canon = canon;
    this.opts = opts;
  }

  build(panel: Phaser.GameObjects.Rectangle) {
    const guests = this.canon.guests;

    const cardW = 120;
    const cardH = 36;
    const perSide = Math.ceil(guests.length / 2);

    const leftX = panel.x - panel.width / 2 + 95;
    const rightX = panel.x + panel.width / 2 - 95;

    const startY = panel.y - 115;
    const gapY = 52;

    guests.forEach((guest, index) => {
      const isLeft = index < perSide;
      const sideIndex = isLeft ? index : index - perSide;

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
          fontSize: "13px",
          color: "#2d2d2d",
          fontStyle: "bold",
          rtl: true,
          align: "center",
          wordWrap: { width: cardW - 12 },
        })
        .setOrigin(0.5);

      const container = this.scene.add
        .container(x, y, [bg, label])
        .setScrollFactor(0)
        .setDepth(this.opts.depth)
        .setSize(cardW, cardH);

      // אזור שקוף ונפרד לגרירה — זה מה שפותר את ה"נגרר רק מהצד"
      const dragZone = this.scene.add
        .zone(x, y, cardW, cardH)
        .setRectangleDropZone(cardW, cardH)
        .setScrollFactor(0)
        .setDepth(this.opts.depth + 1)
        .setInteractive({ useHandCursor: true });

      this.scene.input.setDraggable(dragZone);

      this.opts.root.add(container);
      this.opts.root.add(dragZone);

      const card: GuestCardWithDragZone = {
        guest,
        container,
        bg,
        label,
        dragZone,
        currentSeat: null,
        homeX: x,
        homeY: y,
      };

      this.setupGuestDrag(card);
      this.guestCards.push(card);
    });

    this.registerDropHandler();
  }

  getGuestCards() {
    return this.guestCards;
  }

  private setupGuestDrag(card: GuestCardWithDragZone) {
    const dragTarget = card.dragZone;

    dragTarget.on("dragstart", () => {
      if (this.opts.finished()) return;

      card.container.setScale(1.08);
      card.container.setDepth(999999);
      card.dragZone.setDepth(1000000);
      this.highlightAllSeats(true);
    });

    dragTarget.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (this.opts.finished()) return;

      card.dragZone.x = dragX;
      card.dragZone.y = dragY;
      card.container.x = dragX;
      card.container.y = dragY;
    });

    dragTarget.on("dragend", (_pointer: Phaser.Input.Pointer, dropped: boolean) => {
      if (this.opts.finished()) return;

      card.container.setScale(1);
      card.container.setDepth(this.opts.depth);
      card.dragZone.setDepth(this.opts.depth + 1);
      this.highlightAllSeats(false);

      // אם לא שוחרר על מושב חוקי -> תמיד חוזר למושב הקודם או לבית
      if (!dropped) {
        this.moveCardToSeatOrHome(card);
        this.opts.statusText.setColor("#b00020");
        this.opts.statusText.setText("❌ צריך להניח אורח רק על מקום ישיבה");
      }
    });
  }

  private registerDropHandler() {
    this.dropHandler = (
      _pointer: Phaser.Input.Pointer,
      gameObject: Phaser.GameObjects.GameObject,
      dropZone: Phaser.GameObjects.GameObject
    ) => {
      if (this.opts.finished()) return;

      const card = this.guestCards.find((c) => c.dragZone === gameObject);
      if (!card) return;

      const seat = this.opts.seats.find((s) => s.zone === dropZone);

      // אם זה לא מושב אמיתי, לא משאירים את הכרטיס שם
      if (!seat) {
        this.moveCardToSeatOrHome(card);
        this.opts.statusText.setColor("#b00020");
        this.opts.statusText.setText("❌ צריך להניח אורח רק על מקום ישיבה");
        return;
      }

      this.placeCardInSeat(card, seat.tableId, seat.seatIndex);
    };

    this.scene.input.on(Phaser.Input.Events.DROP, this.dropHandler, this);
  }

  private placeCardInSeat(card: GuestCardWithDragZone, tableId: number, seatIndex: number) {
    const seatValue = this.opts.tables[tableId].seatGuestIds[seatIndex];

    if (seatValue && seatValue !== card.guest.id) {
      this.opts.statusText.setColor("#b00020");
      this.opts.statusText.setText("❌ המקום הזה כבר תפוס");
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
        this.opts.tables[prev.tableId].seatGuestIds[prev.seatIndex] = null;
      }

      existingCardOnSeat.currentSeat = null;
      this.tweenCardTo(existingCardOnSeat, existingCardOnSeat.homeX, existingCardOnSeat.homeY);
    }

    this.opts.tables[tableId].seatGuestIds[seatIndex] = card.guest.id;
    card.currentSeat = { tableId, seatIndex };

    const seatView = this.opts.seats.find(
      (s) => s.tableId === tableId && s.seatIndex === seatIndex
    );

    if (!seatView) {
      this.opts.statusText.setColor("#b00020");
      this.opts.statusText.setText("❌ לא נמצא מושב מתאים");
      this.moveCardToSeatOrHome(card);
      return;
    }

    this.tweenCardTo(card, seatView.x, seatView.y);

    this.opts.statusText.setColor("#2d4a22");
    this.opts.statusText.setText(`${card.guest.label} שובץ לשולחן ${tableId + 1}`);
  }

  private removeGuestFromCurrentSeat(card: GuestCardWithDragZone) {
    if (!card.currentSeat) return;

    const { tableId, seatIndex } = card.currentSeat;

    if (this.opts.tables[tableId].seatGuestIds[seatIndex] === card.guest.id) {
      this.opts.tables[tableId].seatGuestIds[seatIndex] = null;
    }

    card.currentSeat = null;
  }

  private moveCardToSeatOrHome(card: GuestCardWithDragZone) {
    if (card.currentSeat) {
      const seatView = this.opts.seats.find(
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

  private tweenCardTo(card: GuestCardWithDragZone, x: number, y: number) {
    this.scene.tweens.add({
      targets: [card.container, card.dragZone],
      x,
      y,
      duration: 170,
      ease: "Quad.easeOut",
    });
  }

  private highlightAllSeats(active: boolean) {
    for (const seat of this.opts.seats) {
      seat.bg.setFillStyle(active ? 0xfff7cc : 0xffffff, 0.96);
    }
  }

  destroy() {
    if (this.dropHandler) {
      this.scene.input.off(Phaser.Input.Events.DROP, this.dropHandler, this);
      this.dropHandler = undefined;
    }

    for (const card of this.guestCards) {
      card.dragZone.destroy();
      card.container.destroy();
    }

    this.guestCards = [];
  }
}