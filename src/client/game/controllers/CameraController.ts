//src\client\game\controllers\CameraController.ts
// מחלקה זו עוטפת את המצלמה, קובעת גבולות, עושה מעקב לשחקן, מחזירה גבול ימני עם ריווח.


import Phaser from "phaser";

export default class CameraController {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setWorldBounds(totalWidth: number, height: number) {
    this.scene.cameras.main.setBounds(0, 0, totalWidth, height);
  }

  follow(sprite?: Phaser.GameObjects.GameObject | null) {
    if (!sprite) return;
    this.scene.cameras.main.startFollow(sprite, true, 0.12, 0.12);
  }

  stopFollow() {
    this.scene.cameras.main.stopFollow();
  }

  getMaxXPadding(pad: number) {
    return this.scene.cameras.main.getBounds().right - pad;
  }
}