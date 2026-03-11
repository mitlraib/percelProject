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

export default class WeddingSeatingGuestsController {
  private scene: Phaser.Scene;
  private canon: WeddingSeatingCanon;
  private opts: GuestsControllerOpts;

  private guestCards: GuestCardView[] = [];
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
    const cardW = 112;
    const cardH = 36;
    const hitW = 118;
    const hitH = 42;

    const leftX = panel.x - 300;
    const rightX = panel.x + 300;
    const startY = panel.y - 35;
    const gapY = 74;

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
        .setDepth(this.opts.depth)
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
      this.opts.root.add(container);
      this.guestCards.push(card);
    });

    this.registerDropHandler();
  }

  getGuestCards() {
    return this.guestCards;
  }

  private setupGuestDrag(card: GuestCardView) {
    const dragTarget = card.container;

    dragTarget.on("dragstart", () => {
      if (this.opts.finished()) return;

      dragTarget.setScale(1.08);
      dragTarget.setDepth(999999);
      this.highlightAllSeats(true);
    });

    dragTarget.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (this.opts.finished()) return;
      dragTarget.x = dragX;
      dragTarget.y = dragY;
    });

    dragTarget.on("dragend", (_pointer: Phaser.Input.Pointer, dropped: boolean) => {
      if (this.opts.finished()) return;

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
      if (this.opts.finished()) return;

      const card = this.guestCards.find((c) => c.container === gameObject);
      if (!card) return;

      const seat = this.opts.seats.find((s) => s.zone === dropZone);
      if (!seat) {
        this.moveCardToSeatOrHome(card);
        return;
      }

      this.placeCardInSeat(card, seat.tableId, seat.seatIndex);
    };

    this.scene.input.on(Phaser.Input.Events.DROP, this.dropHandler, this);
  }

  private placeCardInSeat(card: GuestCardView, tableId: number, seatIndex: number) {
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
    card.container.setDepth(this.opts.depth);

    this.opts.statusText.setColor("#2d4a22");
    this.opts.statusText.setText(`${card.guest.label} שובץ לשולחן ${tableId + 1}`);
  }

  private removeGuestFromCurrentSeat(card: GuestCardView) {
    if (!card.currentSeat) return;

    const { tableId, seatIndex } = card.currentSeat;
    if (this.opts.tables[tableId].seatGuestIds[seatIndex] === card.guest.id) {
      this.opts.tables[tableId].seatGuestIds[seatIndex] = null;
    }

    card.currentSeat = null;
  }

  private moveCardToSeatOrHome(card: GuestCardView) {
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
    for (const seat of this.opts.seats) {
      seat.bg.setFillStyle(active ? 0xfff7cc : 0xffffff, 0.96);
    }
  }

  destroy() {
    if (this.dropHandler) {
      this.scene.input.off(Phaser.Input.Events.DROP, this.dropHandler, this);
      this.dropHandler = undefined;
    }

    this.guestCards = [];
  }
}