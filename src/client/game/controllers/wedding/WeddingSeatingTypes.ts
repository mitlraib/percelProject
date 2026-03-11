import Phaser from "phaser";
import type { GuestDef, TableState } from "./WeddingSeatingCanon";

export type WeddingSeatingTaskResult =
  | { ok: true }
  | { ok: false; reason: "timeout" | "closed" | "invalid" };

export type WeddingSeatingTaskOpts = {
  depth?: number;
  durationSec?: number;
  onComplete?: (result: WeddingSeatingTaskResult) => void;
};

export type SeatView = {
  tableId: number;
  seatIndex: number;
  x: number;
  y: number;
  zone: Phaser.GameObjects.Zone;
  bg: Phaser.GameObjects.Rectangle;
};

export type GuestCardView = {
  guest: GuestDef;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  currentSeat: { tableId: number; seatIndex: number } | null;
  homeX: number;
  homeY: number;
};

export type WeddingBoardRefs = {
  root: Phaser.GameObjects.Container;
  backdrop: Phaser.GameObjects.Rectangle;
  panel: Phaser.GameObjects.Rectangle;
  titleText: Phaser.GameObjects.Text;
  rulesText: Phaser.GameObjects.Text;
  timerText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  submitBtnBg: Phaser.GameObjects.Rectangle;
  submitBtnLabel: Phaser.GameObjects.Text;
  seats: SeatView[];
};