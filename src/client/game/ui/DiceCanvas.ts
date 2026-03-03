import Phaser from "phaser";

export default class DiceCanvas extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private pips: Phaser.GameObjects.Graphics;

  private value = 1;
  private rolling = false;

  constructor(scene: Phaser.Scene, x: number, y: number, size = 90) {
    super(scene, x, y);
    scene.add.existing(this);

    this.bg = scene.add.graphics();
    this.pips = scene.add.graphics();

    this.add([this.bg, this.pips]);

    this.setSize(size, size);

    // חשוב ← כדי שהציור יתחיל מ-(0,0) בתוך ה-Container
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

  /**
   * גלגול עם אנימציה קלה
   * מחזיר את הערך הסופי
   */
  async roll(durationMs = 900): Promise<number> {
    if (this.rolling) return this.value;
    this.rolling = true;

    const start = Date.now();
    const tickMs = 70;

    // אנימציית "קפיצה" קטנה של ה-Container בזמן הגלגול
    const jumpTween = this.scene.tweens.add({
      targets: this,
      y: this.y - Math.max(8, this.height * 0.12),
      duration: 110,
      yoyo: true,
      repeat: Math.max(3, Math.floor(durationMs / 220)),
      ease: "Sine.inOut",
    });

    while (Date.now() - start < durationMs) {
      const r = Phaser.Math.Between(1, 6);
      this.setValue(r);
      await this.sleep(tickMs);
    }

    // ערך סופי
    const finalValue = Phaser.Math.Between(1, 6);
    this.setValue(finalValue);

    jumpTween.stop();

    // החזרת הקוביה למיקום/סקייל נקי
    this.setScale(1);
    this.rolling = false;

    return finalValue;
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => {
      this.scene.time.delayedCall(ms, () => resolve());
    });
  }

  /**
   * ציור הקוביה בצורה "יותר אמיתית" ← צל, פינות עגולות, מסגרת, נקודות פרופורציונליות
   */
  private draw(size: number, value: number) {
    const s = Math.floor(size);

    this.bg.clear();
    this.pips.clear();

    const radius = Math.round(s * 0.18);
    const border = Math.max(3, Math.round(s * 0.045));
    const shadowOffset = Math.max(3, Math.round(s * 0.06));

    // צל
    this.bg.fillStyle(0x000000, 0.22);
    this.bg.fillRoundedRect(
      shadowOffset,
      shadowOffset,
      s,
      s,
      radius
    );

    // גוף לבן
    this.bg.fillStyle(0xffffff, 1);
    this.bg.fillRoundedRect(0, 0, s, s, radius);

    // מסגרת
    this.bg.lineStyle(border, 0x2b2b2b, 1);
    this.bg.strokeRoundedRect(0, 0, s, s, radius);

    // נקודות
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
}