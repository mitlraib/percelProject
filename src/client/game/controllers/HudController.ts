import Phaser from "phaser";

export default class HudController {
  private scene: Phaser.Scene;

  private box: Phaser.GameObjects.Graphics;
  private container: Phaser.GameObjects.Container;

  private myCharText: Phaser.GameObjects.Text;
  private turnText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.box = scene.add.graphics().setScrollFactor(0).setDepth(1000);

    const { titleSize, subtitleSize, turnOffsetY } = this.getMetrics();

    this.myCharText = scene.add.text(0, 0, "", {
      fontFamily: "Arial Black",
      fontSize: `${titleSize}px`,
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    });

    this.turnText = scene.add.text(0, turnOffsetY, "", {
      fontFamily: "Arial Black",
      fontSize: `${subtitleSize}px`,
      color: "#ffd166",
      stroke: "#000000",
      strokeThickness: 3,
    });

    const { width } = scene.scale;
    const marginX = Math.max(12, Math.round(width * 0.02));
    const marginY = Math.max(10, Math.round(scene.scale.height * 0.02));

    this.container = scene.add
      .container(width - marginX, marginY, [this.box, this.myCharText, this.turnText])
      .setScrollFactor(0)
      .setDepth(1000);

    this.myCharText.setOrigin(1, 0).setPosition(0, 0);
    this.turnText.setOrigin(1, 0).setPosition(0, turnOffsetY);

    this.redraw();
  }

  setText(myLine: string, turnLine: string) {
    this.myCharText.setText(myLine);
    this.turnText.setText(turnLine);
    this.redraw();
  }

  resize() {
    const { width, height } = this.scene.scale;
    const marginX = Math.max(12, Math.round(width * 0.02));
    const marginY = Math.max(10, Math.round(height * 0.02));

    const { titleSize, subtitleSize, turnOffsetY } = this.getMetrics();

    this.myCharText.setStyle({ fontSize: `${titleSize}px` });
    this.turnText.setStyle({ fontSize: `${subtitleSize}px` });

    this.myCharText.setPosition(0, 0);
    this.turnText.setPosition(0, turnOffsetY);

    this.container.setPosition(width - marginX, marginY);
    this.redraw();
  }

  private getMetrics() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const base = Math.min(w, h);

    const titleSize = Math.max(14, Math.round(base * 0.028));
    const subtitleSize = Math.max(12, Math.round(base * 0.024));
    const turnOffsetY = Math.max(20, Math.round(titleSize * 1.35));

    return { titleSize, subtitleSize, turnOffsetY };
  }

  private redraw() {
    const padX = Math.max(12, Math.round(this.scene.scale.width * 0.012));
    const padY = Math.max(8, Math.round(this.scene.scale.height * 0.012));
    const radius = Math.max(12, Math.round(Math.min(this.scene.scale.width, this.scene.scale.height) * 0.02));

    const b1 = this.myCharText.getBounds();
    const b2 = this.turnText.getBounds();

    const left = Math.min(b1.x, b2.x);
    const top = Math.min(b1.y, b2.y);
    const right = Math.max(b1.right, b2.right);
    const bottom = Math.max(b1.bottom, b2.bottom);

    const x = left - padX;
    const y = top - padY;
    const w = right - left + padX * 2;
    const h = bottom - top + padY * 2;

    this.box.clear();

    this.box.fillStyle(0x000000, 0.28);
    this.box.fillRoundedRect(x + 4, y + 6, w, h, radius);

    this.box.fillStyle(0x101828, 0.85);
    this.box.fillRoundedRect(x, y, w, h, radius);

    this.box.fillStyle(0xffffff, 0.1);
    this.box.fillRoundedRect(x + 2, y + 2, w - 4, Math.max(5, Math.round(h * 0.08)), 6);

    this.box.lineStyle(2, 0x5fd1ff, 0.9);
    this.box.strokeRoundedRect(x, y, w, h, radius);
  }

  destroy() {
    this.container.destroy(true);
  }
}