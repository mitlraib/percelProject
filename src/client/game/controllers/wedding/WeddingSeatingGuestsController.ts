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

      const dragZone = this.scene.add
        .zone(x, y, cardW, cardH)
        .setScrollFactor(0)
        .setDepth(this.opts.depth + 1)
        .setSize(cardW, cardH)
        .setInteractive(
          new Phaser.Geom.Rectangle(0, 0, cardW, cardH),
          Phaser.Geom.Rectangle.Contains
        );

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

    dragTarget.on("dragend", () => {
      if (this.opts.finished()) return;

      card.container.setScale(1);
      card.container.setDepth(this.opts.depth);
      card.dragZone.setDepth(this.opts.depth + 1);
      this.highlightAllSeats(false);

      const seat = this.findSeatUnderCard(card);

      if (!seat) {
        this.moveCardToSeatOrHome(card);
        this.opts.statusText.setColor("#b00020");
        this.opts.statusText.setText("❌ צריך להניח אורח רק על מקום ישיבה");
        return;
      }

      this.placeCardInSeat(card, seat.tableId, seat.seatIndex);
    });
  }

  private findSeatUnderCard(card: GuestCardWithDragZone): SeatView | null {
    const snapDistance = 34;

    let bestSeat: SeatView | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const seat of this.opts.seats) {
      const dx = card.container.x - seat.x;
      const dy = card.container.y - seat.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= snapDistance && dist < bestDistance) {
        bestDistance = dist;
        bestSeat = seat;
      }
    }

    return bestSeat;
  }

  private placeCardInSeat(card: GuestCardWithDragZone, tableId: number, seatIndex: number) {
    const seatValue = this.opts.tables[tableId].seatGuestIds[seatIndex];

    // אם יש שם אורח אחר – נבצע "החלפה" ביניהם במקום לחסום לגמרי.
    if (seatValue && seatValue !== card.guest.id) {
      const otherCard = this.guestCards.find(
        (c) => c.currentSeat?.tableId === tableId && c.currentSeat?.seatIndex === seatIndex
      );

      if (otherCard) {
        // משחררים את המקום הקודם של האורח הנגרר
        const prevSeat = card.currentSeat;
        this.removeGuestFromCurrentSeat(card);

        // מעדכנים את המערך הטבלאות עבור שני האורחים
        if (prevSeat) {
          this.opts.tables[prevSeat.tableId].seatGuestIds[prevSeat.seatIndex] = otherCard.guest.id;
        }
        this.opts.tables[tableId].seatGuestIds[seatIndex] = card.guest.id;

        // מעבירים את האורח השני למקום הקודם (או הביתה אם לא היה לו מקום)
        if (prevSeat) {
          otherCard.currentSeat = { tableId: prevSeat.tableId, seatIndex: prevSeat.seatIndex };
          const prevSeatView = this.opts.seats.find(
            (s) => s.tableId === prevSeat.tableId && s.seatIndex === prevSeat.seatIndex
          );
          if (prevSeatView) {
            this.tweenCardTo(otherCard, prevSeatView.x, prevSeatView.y);
          } else {
            otherCard.currentSeat = null;
            this.tweenCardTo(otherCard, otherCard.homeX, otherCard.homeY);
          }
        } else {
          // אם לא היה מקום קודם – האורח השני חוזר לרשימת האורחים
          this.opts.tables[tableId].seatGuestIds[seatIndex] = card.guest.id;
          this.opts.statusText.setColor("#2d4a22");
          this.opts.statusText.setText("✔️ החלפתם בין אורחים");

          this.opts.tables[tableId].seatGuestIds[seatIndex] = card.guest.id;
          otherCard.currentSeat = null;
          this.tweenCardTo(otherCard, otherCard.homeX, otherCard.homeY);
        }
      } else {
        // במקרה קצה – נ fallback להתנהגות הישנה
        this.opts.statusText.setColor("#b00020");
        this.opts.statusText.setText("❌ המקום הזה כבר תפוס");
        this.moveCardToSeatOrHome(card);
        return;
      }
    } else {
      // המקום ריק או זה אותו אורח – פשוט מעבירים אליו
      this.removeGuestFromCurrentSeat(card);
      this.opts.tables[tableId].seatGuestIds[seatIndex] = card.guest.id;
    }

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
    for (const card of this.guestCards) {
      card.dragZone.destroy();
      card.container.destroy();
    }

    this.guestCards = [];
  }
}