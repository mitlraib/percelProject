import Phaser from "phaser";

type TaskBusyType = "mom" | "noam" | "dad";

type OverlayControllerOpts = {
  isMobileDevice: () => boolean;
  onPortraitBlockedChange: (blocked: boolean) => void;
  onBlockInput: () => void;
  onUnblockInput: () => void;
};

export default class ParallaxOverlayController {
  private scene: Phaser.Scene;
  private opts: OverlayControllerOpts;

  private rotateOverlay?: Phaser.GameObjects.Container;
  private isBlocked = false;

  constructor(scene: Phaser.Scene, opts: OverlayControllerOpts) {
    this.scene = scene;
    this.opts = opts;
  }

  getRotateOverlay() {
    return this.rotateOverlay;
  }

  isPortraitBlocked() {
    return this.isBlocked;
  }

  shouldBlockForPortrait(width: number, height: number): boolean {
    return this.opts.isMobileDevice() && height > width;
  }

  createRotateOverlay() {
    const { width, height } = this.scene.scale;

    const bg = this.scene.add
      .rectangle(0, 0, width, height, 0x05050c, 0.94)
      .setOrigin(0, 0)
      .setScrollFactor(0);

    const icon = this.scene.add
      .text(width / 2, height / 2 - 110, "📱↺", {
        fontFamily: "Arial",
        fontSize: `${Math.max(40, Math.min(width * 0.12, 68))}px`,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const title = this.scene.add
      .text(width / 2, height / 2 - 40, "סובבי את המכשיר", {
        fontFamily: "Arial",
        fontSize: `${Math.max(26, Math.min(width * 0.07, 40))}px`,
        fontStyle: "bold",
        color: "#ff66cc",
        align: "center",
        rtl: true,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const subtitle = this.scene.add
      .text(width / 2, height / 2 + 20, "כדי לשחק, צריך מצב אופקי", {
        fontFamily: "Arial",
        fontSize: `${Math.max(16, Math.min(width * 0.04, 24))}px`,
        color: "#ffffff",
        align: "center",
        rtl: true,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.rotateOverlay = this.scene.add
      .container(0, 0, [bg, icon, title, subtitle])
      .setDepth(200000)
      .setScrollFactor(0);

    this.rotateOverlay.setVisible(false);
  }

  refreshRotateOverlay() {
    const { width, height } = this.scene.scale;
    const shouldBlock = this.shouldBlockForPortrait(width, height);

    this.isBlocked = shouldBlock;
    this.opts.onPortraitBlockedChange(shouldBlock);

    if (!this.rotateOverlay) return;

    const bg = this.rotateOverlay.list[0] as Phaser.GameObjects.Rectangle;
    const icon = this.rotateOverlay.list[1] as Phaser.GameObjects.Text;
    const title = this.rotateOverlay.list[2] as Phaser.GameObjects.Text;
    const subtitle = this.rotateOverlay.list[3] as Phaser.GameObjects.Text;

    bg.setPosition(0, 0);
    bg.setSize(width, height);

    icon.setPosition(width / 2, height / 2 - 110);
    title.setPosition(width / 2, height / 2 - 40);
    subtitle.setPosition(width / 2, height / 2 + 20);

    icon.setFontSize(Math.max(40, Math.min(width * 0.12, 68)));
    title.setFontSize(Math.max(26, Math.min(width * 0.07, 40)));
    subtitle.setFontSize(Math.max(16, Math.min(width * 0.04, 24)));

    this.rotateOverlay.setVisible(shouldBlock);

    if (shouldBlock) {
      this.opts.onBlockInput();
    } else {
      this.opts.onUnblockInput();
    }
  }

  showTaskStarted(type: TaskBusyType, playerName: string) {
    if (type === "mom") {
      this.showMomBusy(playerName);
      return;
    }

    if (type === "noam") {
      this.showNoamBusy(playerName);
      return;
    }

    this.showDadBusy(playerName);
  }

  destroy() {
    this.rotateOverlay?.destroy();
    this.rotateOverlay = undefined;
  }

  private showMomBusy(playerName: string) {
    const { width, height } = this.scene.scale;
    const depth = 9000;
    const momH = this.opts.isMobileDevice()
      ? Math.min(160, Math.round(height * 0.22))
      : Math.min(440, Math.round(height * 0.55));
    const momX = width * 0.5;
    const momY = height * 0.72;

    const momImg = this.scene.add
      .image(momX, momY, "MOM")
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(depth);

    const tex = momImg.texture.getSourceImage() as HTMLImageElement;
    const ratio = tex?.width && tex?.height ? tex.width / tex.height : 1;
    momImg.setDisplaySize(momH * ratio, momH);

    const bubbleW = Math.min(520, width * 0.85);
    const speechText = `${playerName} עוזר/ת לי כרגע... מיד תתפנה אליכן.`;

    const label = this.scene.add
      .text(0, 0, speechText, {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#111",
        align: "right",
        wordWrap: { width: bubbleW - 32, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    const padX = 18;
    const padY = 14;
    const bg = this.scene.add.graphics();
    const bw = label.width + padX * 2;
    const bh = label.height + padY * 2;
    const gapAboveMom = 18;
    const tailH = 20;
    const tailW = 14;

    bg.fillStyle(0xffffff, 1);
    bg.lineStyle(2, 0x111111, 0.9);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
    bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
    bg.fillTriangle(0, bh / 2, -tailW, bh / 2 + tailH, tailW, bh / 2 + tailH);
    bg.lineBetween(0, bh / 2, -tailW, bh / 2 + tailH);
    bg.lineBetween(0, bh / 2, tailW, bh / 2 + tailH);
    bg.lineBetween(-tailW, bh / 2 + tailH, tailW, bh / 2 + tailH);

    const momHeadY = momY - momH;
    const bubbleY = momHeadY - bh / 2 - gapAboveMom - tailH;

    const bubble = this.scene.add
      .container(momX, bubbleY, [bg, label])
      .setScrollFactor(0)
      .setDepth(depth + 1);

    momImg.setAlpha(0);
    bubble.setAlpha(0);

    this.scene.tweens.add({
      targets: [momImg, bubble],
      alpha: 1,
      duration: 220,
      ease: "Sine.easeOut",
    });

    this.scene.time.delayedCall(5500, () => {
      this.scene.tweens.add({
        targets: [momImg, bubble],
        alpha: 0,
        duration: 200,
        ease: "Sine.easeIn",
        onComplete: () => {
          momImg.destroy();
          bubble.destroy();
        },
      });
    });
  }

  private showNoamBusy(playerName: string) {
    const { width, height } = this.scene.scale;
    if (!this.scene.textures.exists("NOAM")) return;

    const depth = 9000;
    const noamH = this.opts.isMobileDevice()
      ? Math.min(220, Math.round(height * 0.32))
      : Math.min(420, Math.round(height * 0.52));
    const noamX = width * 0.5;
    const noamY = height * 0.72;

    const noamImg = this.scene.add
      .image(noamX, noamY, "NOAM")
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(depth);

    const tex = noamImg.texture.getSourceImage() as HTMLImageElement;
    const ratio = tex?.width && tex?.height ? tex.width / tex.height : 1;
    noamImg.setDisplaySize(noamH * ratio, noamH);

    const bubbleW = Math.min(480, width * 0.82);
    const speechText = `${playerName} עוזרת לי כרגע... מיד היא תתפנה אליכן.`;

    const label = this.scene.add
      .text(0, 0, speechText, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
        align: "right",
        wordWrap: { width: bubbleW - 32, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    const padX = 18;
    const padY = 14;
    const bg = this.scene.add.graphics();
    const bw = label.width + padX * 2;
    const bh = label.height + padY * 2;
    const gapAbove = 18;
    const tailH = 18;
    const tailW = 12;

    bg.fillStyle(0xffffff, 1);
    bg.lineStyle(2, 0x111111, 0.9);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 14);
    bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 14);
    bg.fillTriangle(0, bh / 2, -tailW, bh / 2 + tailH, tailW, bh / 2 + tailH);
    bg.lineBetween(0, bh / 2, -tailW, bh / 2 + tailH);
    bg.lineBetween(0, bh / 2, tailW, bh / 2 + tailH);
    bg.lineBetween(-tailW, bh / 2 + tailH, tailW, bh / 2 + tailH);

    const noamHeadY = noamY - noamH;
    const bubbleY = noamHeadY - bh / 2 - gapAbove - tailH;

    const bubble = this.scene.add
      .container(noamX, bubbleY, [bg, label])
      .setScrollFactor(0)
      .setDepth(depth + 1);

    noamImg.setAlpha(0);
    bubble.setAlpha(0);

    this.scene.tweens.add({
      targets: [noamImg, bubble],
      alpha: 1,
      duration: 220,
      ease: "Sine.easeOut",
    });

    this.scene.time.delayedCall(3500, () => {
      this.scene.tweens.add({
        targets: [noamImg, bubble],
        alpha: 0,
        duration: 200,
        ease: "Sine.easeIn",
        onComplete: () => {
          noamImg.destroy();
          bubble.destroy();
        },
      });
    });
  }

  private showDadBusy(playerName: string) {
    const { width, height } = this.scene.scale;

    const dadKey = this.scene.textures.exists("DAD")
      ? "DAD"
      : this.scene.textures.exists("dad")
      ? "dad"
      : null;

    if (!dadKey) return;

    const dad = this.scene.add
      .image(width * 0.22, height * 0.9, dadKey)
      .setScrollFactor(0)
      .setDepth(9000);

    const tex = dad.texture.getSourceImage() as HTMLImageElement;
    const ratio = tex?.width && tex?.height ? tex.width / tex.height : 1;
    const targetH = this.opts.isMobileDevice()
      ? Math.min(160, Math.round(height * 0.22))
      : Math.min(420, Math.round(height * 0.55));

    dad.setDisplaySize(targetH * ratio, targetH);

    const bubbleWidth = Math.min(560, width * 0.5);
    const bubbleHeight = 110;

    const bg = this.scene.add
      .rectangle(0, 0, bubbleWidth, bubbleHeight, 0xffffff, 0.98)
      .setStrokeStyle(3, 0x4b2e2e);

    const tail = this.scene.add
      .triangle(
        -(bubbleWidth / 2) + 28,
        bubbleHeight / 2 - 4,
        0,
        0,
        18,
        0,
        5,
        16,
        0xffffff,
        0.98
      )
      .setStrokeStyle(2, 0x4b2e2e);

    const label = this.scene.add
      .text(
        0,
        0,
        `${playerName} עוזר/ת לי כרגע לסדר את השולחנות... מיד תתפנה אליכן.`,
        {
          fontFamily: "Arial",
          fontSize: "18px",
          color: "#3a1f1f",
          align: "center",
          wordWrap: { width: bubbleWidth - 30 },
          rtl: true,
        }
      )
      .setOrigin(0.5);

    const bubble = this.scene.add
      .container(width * 0.6, height * 0.45, [bg, tail, label])
      .setScrollFactor(0)
      .setDepth(9001);

    dad.setAlpha(0);
    bubble.setAlpha(0);

    this.scene.tweens.add({
      targets: [dad, bubble],
      alpha: 1,
      duration: 180,
      ease: "Sine.easeOut",
    });

    this.scene.time.delayedCall(3000, () => {
      this.scene.tweens.add({
        targets: [dad, bubble],
        alpha: 0,
        duration: 180,
        ease: "Sine.easeIn",
        onComplete: () => {
          dad.destroy();
          bubble.destroy();
        },
      });
    });
  }
}