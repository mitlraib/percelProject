export type Mode = "solo" | "local";

export type LayoutMetrics = {
  width: number;
  height: number;
  totalWidth: number;
  laneStartX: number;
  stepSizePx: number;
  groundOffsetY: number;
  groundY: number;
  laneOffsets: number[];
  playerTargetHeight: number;
  diceX: number;
  diceY: number;
  diceSize: number;
};

export type ExtendedNetStateView = {
  ready: boolean;
  myIndex: number | null;
  currentTurn: number;
  canRollNow: boolean;
  names?: Array<string | undefined>;
  avatars?: Array<string | undefined>;
};