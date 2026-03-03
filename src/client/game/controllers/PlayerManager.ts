// src/client/game/controllers/PlayerManager.ts
import Phaser from "phaser";

export type PlayerTextures = string[];

export default class PlayerManager {
  private scene: Phaser.Scene;

  private containers: Phaser.GameObjects.Container[] = [];
  private sprites: Phaser.GameObjects.Image[] = [];
  private totalTexts: Phaser.GameObjects.Text[] = [];
  private steps: number[] = [];
  private tweens: Array<Phaser.Tweens.Tween | null> = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  destroy() {
    for (const t of this.tweens) t?.stop();
    for (const c of this.containers) c.destroy(true);
    this.containers = [];
    this.sprites = [];
    this.totalTexts = [];
    this.steps = [];
    this.tweens = [];
  }

  spawn(opts: {
    textures: PlayerTextures;
    groundY: number;
    laneStartX: number;
    laneOffsets?: number[];
    targetHeight?: number;
    depth?: number;
  }) {
    this.destroy();

    const laneOffsets = opts.laneOffsets ?? [0, 45, 90, 135];
    const targetH = opts.targetHeight ?? 70;
    const depth = opts.depth ?? 50;

    opts.textures.forEach((tex, i) => {
      const offset = laneOffsets[i] ?? 0;
      const y = opts.groundY - offset;

      const img = this.scene.add.image(0, 0, tex).setOrigin(0.5, 1);
      img.setScale(targetH / img.height);

      const totalText = this.scene.add
        .text(0, -img.displayHeight - 8, "0", {
          fontFamily: "Arial",
          fontSize: "14px",
          color: "#000000",
        })
        .setOrigin(0.5, 0.5);

      const container = this.scene.add.container(opts.laneStartX, y, [img, totalText]).setDepth(depth);

      this.containers.push(container);
      this.sprites.push(img);
      this.totalTexts.push(totalText);
      this.steps.push(0);
      this.tweens.push(null);
    });
  }

  getSprite(index: number) {
    return this.sprites[index];
  }

  getContainer(index: number) {
    return this.containers[index];
  }

  getSprites() {
    return this.sprites;
  }

  getSteps(index: number) {
    return this.steps[index] ?? 0;
  }

  moveByDice(opts: {
    playerIndex: number;
    diceValue: number; // ✅ יכול להיות גם שלילי
    laneStartX: number;
    stepSizePx: number;
    maxX: number;
    duration?: number;
    ease?: string;
    onComplete?: () => void;
  }) {
    const container = this.containers[opts.playerIndex];
    if (!container) return;

    const prev = this.tweens[opts.playerIndex];
    if (prev) prev.stop();

    const current = this.steps[opts.playerIndex] ?? 0;
    const next = Math.max(0, current + opts.diceValue); // ✅ clamp ל-0
    this.steps[opts.playerIndex] = next;
    this.totalTexts[opts.playerIndex].setText(String(next));

    const targetX = opts.laneStartX + next * opts.stepSizePx;
    const clampedX = Math.min(targetX, opts.maxX);

    this.tweens[opts.playerIndex] = this.scene.tweens.add({
      targets: container,
      x: clampedX,
      duration: opts.duration ?? 450,
      ease: opts.ease ?? "Sine.out",
      onComplete: () => {
        this.tweens[opts.playerIndex] = null;
        opts.onComplete?.();
      },
    });
  }
}