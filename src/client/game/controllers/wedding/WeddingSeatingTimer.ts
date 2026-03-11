import Phaser from "phaser";

export default class WeddingSeatingTimer {
  private scene: Phaser.Scene;
  private timerText: Phaser.GameObjects.Text;
  private remainingSec: number;
  private timerEvent?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    timerText: Phaser.GameObjects.Text,
    durationSec: number
  ) {
    this.scene = scene;
    this.timerText = timerText;
    this.remainingSec = durationSec;
  }

  start(onTimeout: () => void) {
    this.timerText.setText(`זמן: ${this.remainingSec}`);

    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.remainingSec -= 1;
        this.timerText.setText(`זמן: ${this.remainingSec}`);

        if (this.remainingSec <= 0) {
          this.stop();
          onTimeout();
        }
      },
    });
  }

  stop() {
    this.timerEvent?.remove(false);
    this.timerEvent = undefined;
  }

  destroy() {
    this.stop();
  }
}