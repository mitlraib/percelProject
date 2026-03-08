import Phaser from "phaser";

type LayerBuildResult = {
  sprites: Phaser.GameObjects.Image[];
  y: number;
  tileWidth: number;
  displayHeight: number;
};

export default class WorldBuilder {
  private scene: Phaser.Scene;

  private sky?: Phaser.GameObjects.Image;
  private plateauLayer: Phaser.GameObjects.Image[] = [];
  private groundLayer: Phaser.GameObjects.Image[] = [];
  private plantsLayer: Phaser.GameObjects.Image[] = [];

  private brideSign?: Phaser.GameObjects.Image;
  private brideTween?: Phaser.Tweens.Tween;

  private totalWidth = 0;
  private groundOffsetY = 0;
  private brideKey = "bride";

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  build(opts: {
    totalWidth: number;
    brideKey: string;
    groundOffsetY?: number;
  }) {
    this.destroy();

    this.totalWidth = opts.totalWidth;
    this.groundOffsetY =
      opts.groundOffsetY ?? Math.round(this.scene.scale.height * 0.15);
    this.brideKey = opts.brideKey;

    const { width, height } = this.scene.scale;
    const groundY = height - this.groundOffsetY;

    // Sky: full viewport, behind everything
    this.sky = this.scene.add
      .image(0, 0, "sky")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-1000);
    this.sky.setDisplaySize(width, height);

    // Plateau: anchored at ground line, height scales with viewport
    const plateauHeight = Math.max(height * 0.55, 220);
    const plateau = this.buildRepeatedLayer({
      texture: "plateau",
      y: groundY,
      totalWidth: this.totalWidth,
      scrollFactor: 0.45,
      targetHeight: plateauHeight,
      depth: -300,
      originY: 1,
    });
    this.plateauLayer = plateau.sprites;

    // Ground: path band + extended down to bottom so no purple sky shows under the path
    const groundPathHeight = Math.max(height * 0.18, 80);
    const groundFullHeight = groundPathHeight + (height - groundY);
    const ground = this.buildRepeatedLayer({
      texture: "ground",
      y: height,
      totalWidth: this.totalWidth,
      scrollFactor: 1,
      targetHeight: groundFullHeight,
      depth: -150,
      originY: 1,
    });
    this.groundLayer = ground.sprites;

    // Plants (foreground): bottom-most natural layer — must cover from ground line to bottom so no sky shows
    // Height = distance from ground line to bottom + overlap so there is no gap at any aspect ratio
    const plantsHeight = this.getPlantsTargetHeight(height, groundY);
    const plants = this.buildRepeatedLayer({
      texture: "plants",
      y: height,
      totalWidth: this.totalWidth,
      scrollFactor: 1.15,
      targetHeight: plantsHeight,
      depth: 50,
      originY: 1,
    });
    this.plantsLayer = plants.sprites;

    // Bride sign (UI, fixed to screen)
    this.brideSign = this.scene.add
      .image(width * 0.03, height * 0.06, this.brideKey)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    const brideTargetHeight = Math.max(
      64,
      Math.min(height * 0.16, width * 0.16)
    );
    this.brideSign.setScale(brideTargetHeight / this.brideSign.height);

    this.brideTween = this.scene.tweens.add({
      targets: this.brideSign,
      alpha: 0.85,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    return { groundY };
  }

  /**
   * Plants must always cover from (ground line) to (bottom of screen) so purple sky never shows.
   * Use a generous height so rounding or texture transparency can't leave a strip at the bottom.
   */
  private getPlantsTargetHeight(viewHeight: number, groundY: number): number {
    const fromGroundToBottom = viewHeight - groundY;
    const overlap = Math.max(150, viewHeight * 0.22);
    return Math.ceil(Math.max(fromGroundToBottom + overlap, viewHeight * 0.32, 200));
  }

  resize(opts: {
    totalWidth?: number;
    groundOffsetY?: number;
    brideKey?: string;
  }) {
    if (typeof opts.totalWidth === "number") {
      this.totalWidth = opts.totalWidth;
    }
    if (typeof opts.groundOffsetY === "number") {
      this.groundOffsetY = opts.groundOffsetY;
    }
    if (typeof opts.brideKey === "string") {
      this.brideKey = opts.brideKey;
    }

    const { width, height } = this.scene.scale;
    const groundY = height - this.groundOffsetY;

    if (this.sky) {
      this.sky.setPosition(0, 0);
      this.sky.setDisplaySize(width, height);
    }

    const plateauHeight = Math.max(height * 0.55, 220);
    this.relayoutRepeatedLayer({
      sprites: this.plateauLayer,
      texture: "plateau",
      y: groundY,
      totalWidth: this.totalWidth,
      targetHeight: plateauHeight,
      originY: 1,
      scrollFactor: 0.45,
      depth: -300,
    });

    const groundPathHeight = Math.max(height * 0.18, 80);
    const groundFullHeight = groundPathHeight + (height - groundY);
    this.relayoutRepeatedLayer({
      sprites: this.groundLayer,
      texture: "ground",
      y: height,
      totalWidth: this.totalWidth,
      targetHeight: groundFullHeight,
      originY: 1,
      scrollFactor: 1,
      depth: -150,
    });

    const plantsHeight = this.getPlantsTargetHeight(height, groundY);
    this.relayoutRepeatedLayer({
      sprites: this.plantsLayer,
      texture: "plants",
      y: height,
      totalWidth: this.totalWidth,
      targetHeight: plantsHeight,
      originY: 1,
      scrollFactor: 1.15,
      depth: 50,
    });

    if (this.brideSign) {
      this.brideSign.setPosition(width * 0.03, height * 0.06);
      const brideTargetHeight = Math.max(
        64,
        Math.min(height * 0.16, width * 0.16)
      );
      this.brideSign.setScale(brideTargetHeight / this.brideSign.height);
    }

    return { groundY };
  }

  destroy() {
    this.brideTween?.stop();
    this.brideTween = undefined;

    this.sky?.destroy();
    this.sky = undefined;

    this.destroyLayer(this.plateauLayer);
    this.destroyLayer(this.groundLayer);
    this.destroyLayer(this.plantsLayer);

    this.plateauLayer = [];
    this.groundLayer = [];
    this.plantsLayer = [];

    this.brideSign?.destroy();
    this.brideSign = undefined;
  }

  private destroyLayer(layer: Phaser.GameObjects.Image[]) {
    layer.forEach((sprite) => sprite.destroy());
  }

  private buildRepeatedLayer(opts: {
    texture: string;
    y: number;
    totalWidth: number;
    scrollFactor: number;
    targetHeight: number;
    depth: number;
    originY?: number;
  }): LayerBuildResult {
    const sprites: Phaser.GameObjects.Image[] = [];

    const textureImage = this.scene.textures
      .get(opts.texture)
      .getSourceImage() as HTMLImageElement;

    const textureWidth = textureImage.width || 1;
    const textureHeight = textureImage.height || 1;

    const scale = opts.targetHeight / textureHeight;
    const displayWidth = Math.ceil(textureWidth * scale);
    const displayHeight = Math.ceil(opts.targetHeight);

    const overlap = 2;
    const stepX = Math.max(1, displayWidth - overlap);
    const count = Math.max(1, Math.ceil(opts.totalWidth / stepX) + 3);

    let x = 0;
    for (let i = 0; i < count; i++) {
      const sprite = this.scene.add
        .image(x, opts.y, opts.texture)
        .setOrigin(0, opts.originY ?? 1)
        .setScrollFactor(opts.scrollFactor)
        .setDepth(opts.depth);

      sprite.setDisplaySize(displayWidth, displayHeight);
      sprites.push(sprite);
      x += stepX;
    }

    return {
      sprites,
      y: opts.y,
      tileWidth: displayWidth,
      displayHeight,
    };
  }

  private relayoutRepeatedLayer(opts: {
    sprites: Phaser.GameObjects.Image[];
    texture: string;
    y: number;
    totalWidth: number;
    targetHeight: number;
    originY?: number;
    scrollFactor: number;
    depth: number;
  }) {
    const textureImage = this.scene.textures
      .get(opts.texture)
      .getSourceImage() as HTMLImageElement;

    const textureWidth = textureImage.width || 1;
    const textureHeight = textureImage.height || 1;

    const scale = opts.targetHeight / textureHeight;
    const displayWidth = Math.ceil(textureWidth * scale);
    const displayHeight = Math.ceil(opts.targetHeight);

    const overlap = 2;
    const stepX = Math.max(1, displayWidth - overlap);
    const requiredCount = Math.max(1, Math.ceil(opts.totalWidth / stepX) + 3);

    while (opts.sprites.length < requiredCount) {
      const sprite = this.scene.add
        .image(0, opts.y, opts.texture)
        .setOrigin(0, opts.originY ?? 1)
        .setScrollFactor(opts.scrollFactor)
        .setDepth(opts.depth);
      opts.sprites.push(sprite);
    }

    while (opts.sprites.length > requiredCount) {
      const sprite = opts.sprites.pop();
      sprite?.destroy();
    }

    let x = 0;
    for (const sprite of opts.sprites) {
      sprite.setPosition(x, opts.y);
      sprite.setOrigin(0, opts.originY ?? 1);
      sprite.setScrollFactor(opts.scrollFactor);
      sprite.setDepth(opts.depth);
      sprite.setDisplaySize(displayWidth, displayHeight);
      x += stepX;
    }
  }
}
