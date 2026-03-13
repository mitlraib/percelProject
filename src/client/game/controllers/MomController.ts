import Phaser from "phaser";

export default class MomController {
  private scene: Phaser.Scene;

  private mom?: Phaser.GameObjects.Image;
  private speech?: Phaser.GameObjects.Container;

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

    console.log("[MOM] markShown", {
      playerIndex,
      step,
      ts: Date.now(),
    });
  }

  showMomWithSpeech(params: {
    x: number;
    y: number;
    depth?: number;
    targetHeightPx?: number;
    scale?: number;
    speechText: string;
  }) {
    const { x, y, depth = 400, targetHeightPx, scale = 0.5, speechText } = params;

    console.log("[MOM] showMomWithSpeech", {
      x,
      y,
      depth,
      targetHeightPx,
      scale,
      speechText,
      ts: Date.now(),
    });

    if (!this.mom) {
      this.mom = this.scene.add.image(x, y, "MOM").setOrigin(0.5, 1).setDepth(depth);
    } else {
      this.mom.setPosition(x, y).setVisible(true).setDepth(depth);
    }

    if (typeof targetHeightPx === "number" && targetHeightPx > 0) {
      const tex = this.mom.texture.getSourceImage() as HTMLImageElement;
      const ratio = tex.width / tex.height || 1;
      this.mom.setDisplaySize(targetHeightPx * ratio, targetHeightPx);
    } else {
      this.mom.setScale(scale);
    }

    this.mom.setAlpha(0);
    this.scene.tweens.add({
      targets: this.mom,
      alpha: 1,
      duration: 220,
      ease: "Sine.easeOut",
      onComplete: () => {
        console.log("[MOM] mom fade-in complete", { ts: Date.now() });
        this.showSpeechBubble(speechText, depth + 1);
      },
    });
  }

  private showSpeechBubble(text: string, depth: number) {
    if (!this.mom) return;

    console.log("[MOM] showSpeechBubble", {
      text,
      depth,
      ts: Date.now(),
    });

    this.hideSpeechBubble();

    const mom = this.mom;
    const bubbleX = mom.x + mom.displayWidth * 0.55;
    const bubbleY = mom.y - mom.displayHeight * 0.75;

    const paddingX = 16;
    const paddingY = 12;

    const t = this.scene.add
      .text(0, 0, text, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
        align: "right",
        wordWrap: { width: 280, useAdvancedWrap: true },
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

  hide() {
    console.log("[MOM] hide", { ts: Date.now() });
    this.mom?.setVisible(false);
    this.hideSpeechBubble();
  }

  hideAnimated(onComplete?: () => void) {
    console.log("[MOM] hideAnimated start", {
      hasMom: !!this.mom,
      hasSpeech: !!this.speech,
      ts: Date.now(),
    });

    const targets: any[] = [];
    if (this.mom && this.mom.visible) targets.push(this.mom);
    if (this.speech) targets.push(this.speech);

    if (targets.length === 0) {
      console.log("[MOM] hideAnimated no targets -> onComplete()", {
        ts: Date.now(),
      });
      onComplete?.();
      return;
    }

    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 180,
      ease: "Sine.easeIn",
      onComplete: () => {
        console.log("[MOM] hideAnimated complete", { ts: Date.now() });
        this.hide();
        if (this.mom) this.mom.setAlpha(1);
        onComplete?.();
      },
    });
  }

  private hideSpeechBubble() {
    console.log("[MOM] hideSpeechBubble", { ts: Date.now() });
    this.speech?.destroy(true);
    this.speech = undefined;
  }

  destroy() {
    console.log("[MOM] destroy", { ts: Date.now() });
    this.hideSpeechBubble();
    this.mom?.destroy();
    this.mom = undefined;
    this.shownStepsByPlayer.clear();
  }
}