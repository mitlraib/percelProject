import Phaser from "phaser";

type IntroTarget =
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Image
  | Phaser.GameObjects.Container;

export default class WeddingSeatingIntro {
  private scene: Phaser.Scene;
  private depth: number;

  private introBackdrop?: Phaser.GameObjects.Rectangle;
  private introDad?: Phaser.GameObjects.Image;
  private introBubble?: Phaser.GameObjects.Container;
  private introTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene;
    this.depth = depth;
  }

  open(onDone: () => void) {
    const { width, height } = this.scene.scale;

    this.introBackdrop = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.3)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(this.depth);

    const dadKey = this.scene.textures.exists("DAD")
      ? "DAD"
      : this.scene.textures.exists("dad")
        ? "dad"
        : null;

    if (dadKey) {
      this.introDad = this.scene.add
        .image(width * 0.22, height * 0.66, dadKey)
        .setScrollFactor(0)
        .setDepth(this.depth + 2);

      const tex = this.introDad.texture.getSourceImage() as HTMLImageElement;
      const ratio = tex?.width && tex?.height ? tex.width / tex.height : 1;

      // הוגדל משמעותית לעומת קודם
      const targetH = Math.min(360, height * 0.5);
      this.introDad.setDisplaySize(targetH * ratio, targetH);
    }

    this.introBubble = this.createSpeechBubble(
      width * 0.56,
      height * 0.43,
      Math.min(560, width * 0.5),
      110,
      "אוי! תכף החתונה ויש כזה בלאגן בשולחנות.\nתוכלי לעזור לי לסדר את האורחים בשולחנות?",
      this.depth + 3
    );

    const introTargets: IntroTarget[] = [];
    if (this.introBackdrop) introTargets.push(this.introBackdrop);
    if (this.introDad) introTargets.push(this.introDad);
    if (this.introBubble) introTargets.push(this.introBubble);

    for (const target of introTargets) {
      target.setAlpha(0);
    }

    this.scene.tweens.add({
      targets: introTargets,
      alpha: 1,
      duration: 180,
      ease: "Sine.easeOut",
    });

    this.introTimer = this.scene.time.delayedCall(2000, () => {
      this.hide(onDone);
    });
  }

  private createSpeechBubble(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    depth: number
  ): Phaser.GameObjects.Container {
    const bg = this.scene.add
      .rectangle(0, 0, w, h, 0xffffff, 0.98)
      .setStrokeStyle(3, 0x4b2e2e);

    const tail = this.scene.add
      .triangle(-(w / 2) + 28, h / 2 - 4, 0, 0, 18, 0, 5, 16, 0xffffff, 0.98)
      .setStrokeStyle(2, 0x4b2e2e);

    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#3a1f1f",
        align: "center",
        wordWrap: { width: w - 30 },
        rtl: true,
      })
      .setOrigin(0.5);

    return this.scene.add
      .container(x, y, [bg, tail, label])
      .setScrollFactor(0)
      .setDepth(depth);
  }

  private hide(onDone: () => void) {
    const targets: IntroTarget[] = [];
    if (this.introBackdrop) targets.push(this.introBackdrop);
    if (this.introDad) targets.push(this.introDad);
    if (this.introBubble) targets.push(this.introBubble);

    if (targets.length === 0) {
      onDone();
      return;
    }

    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 180,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.destroy();
        onDone();
      },
    });
  }

  destroy() {
    this.introTimer?.remove(false);
    this.introBackdrop?.destroy();
    this.introDad?.destroy();
    this.introBubble?.destroy();

    this.introBackdrop = undefined;
    this.introDad = undefined;
    this.introBubble = undefined;
    this.introTimer = undefined;
  }
}