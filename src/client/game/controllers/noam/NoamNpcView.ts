// src/client/game/controllers/noam/NoamNpcView.ts
import Phaser from "phaser";

export default class NoamNpcView {
  private scene: Phaser.Scene;

  private noam?: Phaser.GameObjects.Image;
  private speech?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(params: { x: number; y: number; depth: number; targetHeightPx: number; speechText: string }) {
    const { x, y, depth, targetHeightPx, speechText } = params;

    if (!this.noam) {
      this.noam = this.scene.add.image(x, y, "NOAM").setOrigin(0.5, 1).setDepth(depth);
    } else {
      this.noam.setPosition(x, y).setVisible(true).setDepth(depth);
    }

    const tex = this.noam.texture.getSourceImage() as HTMLImageElement;
    const ratio = tex.width / tex.height || 1;
    this.noam.setDisplaySize(targetHeightPx * ratio, targetHeightPx);

    this.noam.setAlpha(0);
    this.scene.tweens.add({
      targets: this.noam,
      alpha: 1,
      duration: 220,
      ease: "Sine.easeOut",
      onComplete: () => this.showSpeechBubble(speechText, depth + 1),
    });
  }

  hideSpeechOnly() {
    this.speech?.destroy(true);
    this.speech = undefined;
  }

  hideAll() {
    this.hideSpeechOnly();
    this.noam?.destroy();
    this.noam = undefined;
  }

  destroy() {
    this.hideAll();
  }

  private showSpeechBubble(text: string, depth: number) {
    if (!this.noam) return;

    this.hideSpeechOnly();

    const bubbleX = this.noam.x + this.noam.displayWidth * 0.45;
    const bubbleY = this.noam.y - this.noam.displayHeight * 0.75;

    const paddingX = 18;
    const paddingY = 14;

    const t = this.scene.add
      .text(0, 0, text, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
        align: "right",
        wordWrap: { width: 360, useAdvancedWrap: true },
      })
      .setOrigin(1, 0);

    const bg = this.scene.add.graphics();
    const w = t.width + paddingX * 2;
    const h = t.height + paddingY * 2;

    t.setPosition(w - paddingX, paddingY);

    bg.fillStyle(0xffffff, 1);
    bg.lineStyle(2, 0x111111, 0.9);

    const r = 16;
    bg.fillRoundedRect(0, 0, w, h, r);
    bg.strokeRoundedRect(0, 0, w, h, r);

    const tailMidY = h * 0.6;
    bg.fillTriangle(0, tailMidY - 10, 0, tailMidY + 10, -18, tailMidY);
    bg.lineBetween(0, tailMidY - 10, -18, tailMidY);
    bg.lineBetween(0, tailMidY + 10, -18, tailMidY);

    const c = this.scene.add.container(bubbleX, bubbleY, [bg, t]).setDepth(depth);
    c.setAlpha(0);
    c.setScale(0.96);

    this.scene.tweens.add({
      targets: c,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Sine.easeOut",
    });

    this.speech = c;
  }
}