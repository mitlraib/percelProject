import Phaser from "phaser";
import type { LayoutMetrics } from "./ParallaxTypes";

export default class ParallaxLayoutManager {
  compute(width: number, height: number): LayoutMetrics {
    const safeWidth = Math.max(width, 320);
    const safeHeight = Math.max(height, 480);

    const laneStartX = Math.round(safeWidth * 0.1);
    const stepSizePx = Math.round(
      Math.max(52, Math.min(safeWidth * 0.12, 110))
    );

    const stepsCount = 32;
    const totalWidth =
      laneStartX + stepsCount * stepSizePx + Math.round(safeWidth * 0.25);

    const groundOffsetY = Math.round(safeHeight * 0.15);

    // גובה השחקנים – עוד יותר גדול, אבל עדיין פרופורציונלי למסך
    const playerTargetHeight = Math.round(
      Math.max(72, Math.min(safeHeight * 0.20, safeWidth * 0.24))
    );

    // כל הדמויות על אותו קו גובה, אבל קצת מעל הקרקע (מעל הסלעים)
    const baseOffset = Math.round(playerTargetHeight * 0.6);
    const laneOffsets = [baseOffset, baseOffset, baseOffset, baseOffset];

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