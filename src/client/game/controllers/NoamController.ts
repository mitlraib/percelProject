// src/client/game/controllers/NoamController.ts
import Phaser from "phaser";

export default class NoamController {
  private scene: Phaser.Scene;

  private noam?: Phaser.GameObjects.Image;
  private speech?: Phaser.GameObjects.Container;

  // לכל שחקן: אילו שלבים כבר הוצגו (27, 30)
  private shownStepsByPlayer = new Map<number, Set<number>>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  hasShown(playerIndex: number, step: number) {
    return this.shownStepsByPlayer.get(playerIndex)?.has(step) ?? false;
  }

  markShown(playerIndex: number, step: number) {
    if (!this.shownStepsByPlayer.has(playerIndex)) {
      this.shownStepsByPlayer.set(playerIndex, new Set<number>());
    }
    this.shownStepsByPlayer.get(playerIndex)!.add(step);
  }

  showNoamWithSpeech(params: {
    x: number;
    y: number;
    depth?: number;

    targetHeightPx?: number;
    scale?: number;

    speechText: string;
  }) {
    const { x, y, depth = 450, targetHeightPx, scale = 0.8, speechText } = params;

    if (!this.noam) {
      this.noam = this.scene.add.image(x, y, "NOAM").setOrigin(0.5, 1).setDepth(depth);
    } else {
      this.noam.setPosition(x, y).setVisible(true).setDepth(depth);
    }

    // ✅ גדול יותר
    if (typeof targetHeightPx === "number" && targetHeightPx > 0) {
      const tex = this.noam.texture.getSourceImage() as HTMLImageElement;
      const ratio = tex.width / tex.height || 1;
      this.noam.setDisplaySize(targetHeightPx * ratio, targetHeightPx);
    } else {
      this.noam.setScale(scale);
    }

    this.noam.setAlpha(0);
    this.scene.tweens.add({
      targets: this.noam,
      alpha: 1,
      duration: 220,
      ease: "Sine.easeOut",
      onComplete: () => this.showSpeechBubble(speechText, depth + 1),
    });
  }

  hide() {
    this.noam?.setVisible(false);
    this.hideSpeechBubble();
  }

  hideAnimated(onComplete?: () => void) {
    const targets: any[] = [];
    if (this.noam && this.noam.visible) targets.push(this.noam);
    if (this.speech) targets.push(this.speech);

    if (targets.length === 0) {
      onComplete?.();
      return;
    }

    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 180,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.hide();
        if (this.noam) this.noam.setAlpha(1);
        onComplete?.();
      },
    });
  }

  private showSpeechBubble(text: string, depth: number) {
    if (!this.noam) return;

    this.hideSpeechBubble();

    const noam = this.noam;

    // בועה בצד ימין של נועם, עם זנב שמאלה (כמו אצל אמא)
    const bubbleX = noam.x + noam.displayWidth * 0.55;
    const bubbleY = noam.y - noam.displayHeight * 0.75;

    const paddingX = 16;
    const paddingY = 12;

    const t = this.scene.add
      .text(0, 0, text, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
        align: "right",
        wordWrap: { width: 340, useAdvancedWrap: true },
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

    const container = this.scene.add.container(bubbleX, bubbleY, [bg, t]).setDepth(depth);
    container.setAlpha(0);
    container.setScale(0.96);

    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Sine.easeOut",
    });

    this.speech = container;
  }

  private hideSpeechBubble() {
    this.speech?.destroy(true);
    this.speech = undefined;
  }

  destroy() {
    this.hideSpeechBubble();
    this.noam?.destroy();
    this.noam = undefined;
    this.shownStepsByPlayer.clear();
  }
}