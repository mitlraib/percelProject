import Phaser from "phaser";
import type { LayoutMetrics } from "./ParallaxTypes";

export default class ParallaxLayoutManager {
  compute(width: number, height: number): LayoutMetrics {
    const safeWidth = Math.max(width, 320);

    // במכשירים גבוהים מאוד (נייד אנכי) נקטין את גובה הלייאאוט,
    // כדי שלא תתקבל תחושה של "מסך צר וארוך". נוסיף יותר "שמיים" מעל.
    const aspect = height / Math.max(width, 1);
    const maxLayoutHeight =
      aspect > 1.5 ? Math.min(height, safeWidth * 1.4) : height;

    const safeHeight = Math.max(maxLayoutHeight, 480);

    const laneStartX = Math.round(safeWidth * 0.1);
    const stepSizePx = Math.round(
      Math.max(52, Math.min(safeWidth * 0.12, 110))
    );

    const stepsCount = 32;
    const totalWidth =
      laneStartX + stepsCount * stepSizePx + Math.round(safeWidth * 0.25);

    const groundOffsetY = Math.round(safeHeight * 0.15);

    const playerTargetHeight = Math.round(
      Math.max(48, Math.min(safeHeight * 0.12, safeWidth * 0.15))
    );

    const laneOffsets = [
      0,
      Math.round(playerTargetHeight * 0.65),
      Math.round(playerTargetHeight * 1.3),
      Math.round(playerTargetHeight * 1.95),
    ];

    const diceSize = Math.round(
      Math.max(58, Math.min(safeWidth, safeHeight) * 0.12)
    );

    return {
      width: safeWidth,
      height: safeHeight,
      totalWidth,
      laneStartX,
      stepSizePx,
      groundOffsetY,
      groundY: 0,
      laneOffsets,
      playerTargetHeight,
      diceX: safeWidth * 0.5,
      diceY: safeHeight * 0.58,
      diceSize,
    };
  }
}