import Phaser from "phaser";

export type PlayerTextures = string[];

/** Depth above WorldBuilder plants layer (50) so players draw in front of foreground. */
const PLAYER_DEPTH = 200;

export default class PlayerManager {
  private scene: Phaser.Scene;

  private containers: Phaser.GameObjects.Container[] = [];
  private sprites: Phaser.GameObjects.Image[] = [];
  private totalTexts: Phaser.GameObjects.Text[] = [];
  private nameTexts: Phaser.GameObjects.Text[] = [];
  private steps: number[] = [];
  private tweens: Array<Phaser.Tweens.Tween | null> = [];

  private laneOffsets: number[] = [];
  private targetHeight = 70;
  private depth = PLAYER_DEPTH;
  private laneStartX = 0;
  private groundY = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  destroy() {
    for (const t of this.tweens) t?.stop();
    for (const c of this.containers) c.destroy(true);

    this.containers = [];
    this.sprites = [];
    this.totalTexts = [];
    this.nameTexts = [];
    this.steps = [];
    this.tweens = [];
    this.laneOffsets = [];
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

    this.groundY = opts.groundY;
    this.laneStartX = opts.laneStartX;
    this.laneOffsets = opts.laneOffsets ?? [0, 45, 90, 135];
    this.targetHeight = opts.targetHeight ?? 70;
    this.depth = opts.depth ?? PLAYER_DEPTH;

    opts.textures.forEach((tex, i) => {
      const offset = this.laneOffsets[i] ?? 0;
      const y = this.groundY - offset;

      const img = this.scene.add.image(0, 0, tex).setOrigin(0.5, 1);
      this.applyTargetScale(img);

      const fontPx = Math.max(14, Math.round(this.targetHeight * 0.22));

      const totalText = this.scene.add
        .text(0, -img.displayHeight - Math.max(8, this.targetHeight * 0.08), "0", {
          fontFamily: "Arial",
          fontSize: `${fontPx}px`,
          color: "#000000",
        })
        .setOrigin(0.5, 0.5);

      const nameFontPx = Math.max(14, Math.round(this.targetHeight * 0.22));
      const nameText = this.scene.add
        .text(0, Math.max(6, this.targetHeight * 0.12), "", {
          fontFamily: "Arial",
          fontSize: `${nameFontPx}px`,
          color: "#000000",
          align: "center",
        })
        .setOrigin(0.5, 0);

      const container = this.scene.add
        .container(this.laneStartX, y, [img, totalText, nameText])
        .setDepth(this.depth);

      this.containers.push(container);
      this.sprites.push(img);
      this.totalTexts.push(totalText);
      this.nameTexts.push(nameText);
      this.steps.push(0);
      this.tweens.push(null);
    });
  }

  relayout(opts: {
    groundY: number;
    laneStartX: number;
    stepSizePx: number;
    laneOffsets?: number[];
    targetHeight?: number;
    maxX?: number;
  }) {
    this.groundY = opts.groundY;
    this.laneStartX = opts.laneStartX;

    if (opts.laneOffsets) {
      this.laneOffsets = opts.laneOffsets;
    }

    if (opts.targetHeight) {
      this.targetHeight = opts.targetHeight;
    }

    this.containers.forEach((container, i) => {
      const sprite = this.sprites[i];
      const totalText = this.totalTexts[i];
      const nameText = this.nameTexts[i];
      const offset = this.laneOffsets[i] ?? 0;

      container.y = this.groundY - offset;
      container.setDepth(this.depth);

      this.applyTargetScale(sprite);

      const fontPx = Math.max(14, Math.round(this.targetHeight * 0.22));
      totalText.setStyle({ fontSize: `${fontPx}px` });
      totalText.setPosition(0, -sprite.displayHeight - Math.max(8, this.targetHeight * 0.08));

      if (nameText) {
        const nameFontPx = Math.max(14, Math.round(this.targetHeight * 0.22));
        nameText.setStyle({ fontSize: `${nameFontPx}px` });
        nameText.setPosition(0, Math.max(6, this.targetHeight * 0.12));
      }

      const steps = this.steps[i] ?? 0;
      const targetX = this.laneStartX + steps * opts.stepSizePx;
      const clampedX =
        typeof opts.maxX === "number" ? Math.min(targetX, opts.maxX) : targetX;

      container.x = clampedX;
    });
  }

  getSprite(index: number) {
    return this.sprites[index];
  }

  /** מחליף את הטקסטורה של שחקן (למשל תמונה שהועלתה). מעדכן סקייל לפי targetHeight. */
  setPlayerTexture(playerIndex: number, textureKey: string) {
    const sprite = this.sprites[playerIndex];
    if (!sprite) return;
    sprite.setTexture(textureKey);
    this.applyTargetScale(sprite);
  }

  /** מגדיר סקייל כך שהדמות תהיה בגובה אחיד ולא תתפרס לרוחב מוגזם (למשל לוגואים רחבים). */
  private applyTargetScale(img: Phaser.GameObjects.Image) {
    if (!img.height || !img.width) {
      return;
    }

    // גובה בסיסי
    let scale = this.targetHeight / img.height;
    img.setScale(scale);

    // אם אחרי הסקייל הרוחב עדיין גדול מדי ביחס לגובה – נצמצם אותו
    const maxWidth = this.targetHeight * 0.9; // בערך ריבועי
    if (img.displayWidth > maxWidth) {
      scale = maxWidth / img.width;
      img.setScale(scale);
    }
  }

  getContainer(index: number) {
    return this.containers[index];
  }

  getSprites() {
    return this.sprites;
  }

  /** מציב שמות מתחת לכל שחקן לפי אינדקס. */
  setPlayerNames(names: string[]) {
    names.forEach((name, i) => {
      const t = this.nameTexts[i];
      if (t) {
        t.setText(name);
      }
    });
  }

  getSteps(index: number) {
    return this.steps[index] ?? 0;
  }

  moveByDice(opts: {
    playerIndex: number;
    diceValue: number;
    laneStartX: number;
    stepSizePx: number;
    maxX: number;
    duration?: number;
    ease?: string;
    onComplete?: () => void;
  }) {
    const idx = opts.playerIndex;
    const container = this.containers[idx];

    if (!container) {
      opts.onComplete?.();
      return;
    }

    const prev = this.tweens[idx];
    if (prev) {
      prev.stop();
      this.tweens[idx] = null;
    }

    const currentSteps = this.steps[idx] ?? 0;
    const nextSteps = Math.max(0, currentSteps + opts.diceValue);
    this.steps[idx] = nextSteps;

    const t = this.totalTexts[idx];
    if (t) t.setText(String(nextSteps));

    const targetX = opts.laneStartX + nextSteps * opts.stepSizePx;
    const clampedX = Math.min(targetX, opts.maxX);

    if (Math.abs(container.x - clampedX) < 0.5) {
      opts.onComplete?.();
      return;
    }

    this.tweens[idx] = this.scene.tweens.add({
      targets: container,
      x: clampedX,
      duration: opts.duration ?? 450,
      ease: opts.ease ?? "Sine.out",
      onComplete: () => {
        this.tweens[idx] = null;
        opts.onComplete?.();
      },
    });
  }
}
