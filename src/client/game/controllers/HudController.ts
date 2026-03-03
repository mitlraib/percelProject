
//src\client\game\controllers\HudController.ts

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

    this.myCharText = scene.add.text(0, 0, "", {
      fontFamily: "Arial Black",
      fontSize: "18px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
    });

    this.turnText = scene.add.text(0, 26, "", {
      fontFamily: "Arial Black",
      fontSize: "16px",
      color: "#ffd166",
      stroke: "#000000",
      strokeThickness: 3,
    });

    const { width } = scene.scale;
    this.container = scene.add
      .container(width - 20, 16, [this.box, this.myCharText, this.turnText])
      .setScrollFactor(0)
      .setDepth(1000);

    this.myCharText.setOrigin(1, 0).setPosition(0, 0);
    this.turnText.setOrigin(1, 0).setPosition(0, 26);

    this.redraw();
  }

  setText(myLine: string, turnLine: string) {
    this.myCharText.setText(myLine);
    this.turnText.setText(turnLine);
    this.redraw();
  }

  resize() {
    const { width } = this.scene.scale;
    this.container.setPosition(width - 20, 16);
    this.redraw();
  }

  private redraw() {
    const padX = 18;
    const padY = 12;
    const radius = 18;

    const b1 = this.myCharText.getBounds();
    const b2 = this.turnText.getBounds();

    const left = Math.min(b1.x, b2.x);
    const top = Math.min(b1.y, b2.y);
    const right = Math.max(b1.right, b2.right);
    const bottom = Math.max(b1.bottom, b2.bottom);

    const x = left - padX;
    const y = top - padY;
    const w = (right - left) + padX * 2;
    const h = (bottom - top) + padY * 2;

    this.box.clear();

    this.box.fillStyle(0x000000, 0.28);
    this.box.fillRoundedRect(x + 4, y + 6, w, h, radius);

    this.box.fillStyle(0x101828, 0.85);
    this.box.fillRoundedRect(x, y, w, h, radius);

    this.box.fillStyle(0xffffff, 0.10);
    this.box.fillRoundedRect(x + 2, y + 2, w - 4, 6, 6);

    this.box.lineStyle(2, 0x5fd1ff, 0.9);
    this.box.strokeRoundedRect(x, y, w, h, radius);
  }

  destroy() {
    this.container.destroy(true);
  }
}