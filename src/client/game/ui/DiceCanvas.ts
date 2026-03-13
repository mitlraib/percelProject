import Phaser from "phaser";

export default class DiceCanvas extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private pips: Phaser.GameObjects.Graphics;

  private value = 1;
  private rolling = false;
  private baseY: number;

  private shuffleTimer?: Phaser.Time.TimerEvent;
  private finishTimer?: Phaser.Time.TimerEvent;
  private jumpTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, size = 90) {
    super(scene, x, y);
    scene.add.existing(this);

    this.baseY = y;

    this.bg = scene.add.graphics();
    this.pips = scene.add.graphics();

    this.add([this.bg, this.pips]);

    this.setSize(size, size);

    this.bg.setPosition(0, 0);
    this.pips.setPosition(0, 0);

    this.draw(size, this.value);
  }

  setValue(v: number) {
    this.value = Phaser.Math.Clamp(v, 1, 6);
    this.draw(this.width, this.value);
  }

  getValue() {
    return this.value;
  }

  isRolling() {
    return this.rolling;
  }

  setDiceSize(size: number) {
    const safeSize = Math.max(36, Math.round(size));
    this.setSize(safeSize, safeSize);
    this.draw(safeSize, this.value);
  }

  setDicePosition(x: number, y: number) {
    this.baseY = y;
    this.setPosition(x, y);
  }

  /**
   * אנימציה ויזואלית בלבד – לא חוסמת את המשחק.
   * איטית יותר כדי להרגיש "גלגול" ברור.
   */
  playVisualRoll(finalValue: number, durationMs = 700) {
    if (this.rolling) {
      this.stopRollingVisuals();
    }

    this.rolling = true;

    const jumpHeight = Math.max(8, this.height * 0.12);

    this.jumpTween = this.scene.tweens.add({
      targets: this,
      y: this.baseY - jumpHeight,
      duration: 90,
      yoyo: true,
      repeat: Math.max(2, Math.floor(durationMs / 180)),
      ease: "Sine.inOut",
    });

    this.shuffleTimer = this.scene.time.addEvent({
      delay: 55,
      loop: true,
      callback: () => {
        this.setValue(Phaser.Math.Between(1, 6));
      },
    });

    this.finishTimer = this.scene.time.delayedCall(durationMs, () => {
      this.stopRollingVisuals();
      this.setValue(finalValue);
    });
  }

  private stopRollingVisuals() {
    this.shuffleTimer?.remove(false);
    this.shuffleTimer = undefined;

    this.finishTimer?.remove(false);
    this.finishTimer = undefined;

    this.jumpTween?.stop();
    this.jumpTween = undefined;

    this.setY(this.baseY);
    this.setScale(1);
    this.rolling = false;
  }

  private draw(size: number, value: number) {
    const s = Math.floor(size);

    this.bg.clear();
    this.pips.clear();

    const radius = Math.round(s * 0.18);
    const border = Math.max(3, Math.round(s * 0.045));
    const shadowOffset = Math.max(3, Math.round(s * 0.06));

    this.bg.fillStyle(0x000000, 0.22);
    this.bg.fillRoundedRect(shadowOffset, shadowOffset, s, s, radius);

    this.bg.fillStyle(0xffffff, 1);
    this.bg.fillRoundedRect(0, 0, s, s, radius);

    this.bg.lineStyle(border, 0x2b2b2b, 1);
    this.bg.strokeRoundedRect(0, 0, s, s, radius);

    const dotR = Math.max(4, Math.round(s * 0.075));
    const c = s / 2;
    const o = s * 0.27;
    const e = s * 0.73;

    const dot = (x: number, y: number) => {
      this.pips.fillStyle(0x111111, 1);
      this.pips.fillCircle(x, y, dotR);
    };

    const map: Record<number, Array<[number, number]>> = {
      1: [[c, c]],
      2: [[o, o], [e, e]],
      3: [[o, o], [c, c], [e, e]],
      4: [[o, o], [e, o], [o, e], [e, e]],
      5: [[o, o], [e, o], [c, c], [o, e], [e, e]],
      6: [[o, o], [e, o], [o, c], [e, c], [o, e], [e, e]],
    };

    map[value].forEach(([x, y]) => dot(x, y));
  }

  destroy(fromScene?: boolean) {
    this.stopRollingVisuals();
    this.bg.destroy();
    this.pips.destroy();
    super.destroy(fromScene);
  }
}