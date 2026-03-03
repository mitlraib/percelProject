import Phaser from "phaser";

const createAligned = (scene: Phaser.Scene, totalWidth: number, texture: string, scrollFactor: number) => {
  const w = scene.textures.get(texture).getSourceImage().width;
  const count = Math.ceil(totalWidth / w) * scrollFactor;

  let x = 0;
  for (let i = 0; i < count; i++) {
    const m = scene.add.image(x, scene.scale.height, texture).setOrigin(0, 1).setScrollFactor(scrollFactor);
    x += m.width;
  }
};

export default class WorldBuilder {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  build(opts: {
    totalWidth: number;
    brideKey: string;
    groundOffsetY?: number; // default 90
  }) {
    const { width, height } = this.scene.scale;
    const groundOffsetY = opts.groundOffsetY ?? 90;
    const groundY = height - groundOffsetY;

    // layers
    this.scene.add.image(width * 0.5, height * 0.5, "sky").setScrollFactor(0);
    createAligned(this.scene, opts.totalWidth, "plateau", 0.5);
    createAligned(this.scene, opts.totalWidth, "ground", 1);
    createAligned(this.scene, opts.totalWidth, "plants", 1.25);

    // bride sign
    const brideSign = this.scene.add
      .image(20, 20, opts.brideKey)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    brideSign.setScale(90 / brideSign.height);

    this.scene.tweens.add({
      targets: brideSign,
      alpha: 0.85,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    return { groundY };
  }
}