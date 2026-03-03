// src/client/game/ui/DiceRollerCanvas.ts
import Phaser from "phaser";
import DiceCanvas from "./DiceCanvas";

type RollEvent = { value: number };

type DiceRollerCanvasCfg = {
  x: number;
  y: number;
  scrollFactor?: number;
  depth?: number;
  size?: number;
  currentPlayerName?: string;
  currentPlayerEmoji?: string;
};

export default class DiceRollerCanvas extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;

  private dice: DiceCanvas;
  private hitZone: Phaser.GameObjects.Zone;

  private disabled = false;
  private lastRoll = 0;

  private playerName = "";
  private playerEmoji = "🎲";

  constructor(scene: Phaser.Scene, cfg: DiceRollerCanvasCfg) {
    super();
    this.scene = scene;

    const size = cfg.size ?? 64;

    this.playerName = cfg.currentPlayerName ?? "";
    this.playerEmoji = cfg.currentPlayerEmoji ?? "🎲";

    this.dice = new DiceCanvas(scene, cfg.x, cfg.y, size)
      .setScrollFactor(cfg.scrollFactor ?? 0)
      .setDepth(cfg.depth ?? 10000);

    this.hitZone = scene.add
      .zone(cfg.x, cfg.y, size + 30, size + 30)
      .setScrollFactor(cfg.scrollFactor ?? 0)
      .setDepth((cfg.depth ?? 10000) + 1)
      .setInteractive({ useHandCursor: true });

    this.hitZone.on("pointerdown", () => {
      this.tryRollFromInput();
    });
  }

  onRoll(cb: (e: RollEvent) => void) {
    this.on("roll", cb);
    return this;
  }

  isDisabled() {
    return this.disabled;
  }

  setDisabled(v: boolean) {
    this.disabled = v;

    // disable/enable input
    this.hitZone.disableInteractive();
    if (!v) {
      this.hitZone.setInteractive({ useHandCursor: true });
    }

    this.dice.setAlpha(v ? 0.65 : 1);
  }

  setVisible(v: boolean) {
    this.dice.setVisible(v);
    this.hitZone.setVisible(v);
    this.hitZone.active = v;
  }

  setPlayer(name: string, emoji: string) {
    this.playerName = name;
    this.playerEmoji = emoji;
  }

  setLastRoll(v: number) {
    this.lastRoll = v;
    this.dice.setValue(Math.max(1, Math.min(6, v)));
  }

  tryRollFromInput() {
    if (this.disabled) return;
    if (!this.dice.visible) return;
    if (this.dice.isRolling()) return;

    this.rollAndEmit(800);
  }

  // גלגול "רגיל" (מכבד disabled + visible)
  async roll(durationMs = 800): Promise<number> {
    if (this.disabled) return this.lastRoll || this.dice.getValue();
    if (!this.dice.visible) return this.lastRoll || this.dice.getValue();
    if (this.dice.isRolling()) return this.lastRoll || this.dice.getValue();

    return this.rollAndEmit(durationMs);
  }

  /**
   * ✅ גלגול לבוט:
   * - לא תלוי disabled
   * - לא תלוי visible
   *
   * אם הקובייה מוסתרת (למשל בזמן תור בוט) – לא עושים אנימציה,
   * אבל כן מגרילים ערך וכן עושים emit("roll") כדי שהמשחק יתקדם.
   */
  async rollForced(durationMs = 800): Promise<number> {
    if (this.dice.isRolling()) return this.lastRoll || this.dice.getValue();

    // אם מוסתר: בלי אנימציה, אבל עם roll event
    if (!this.dice.visible) {
      const value = Phaser.Math.Between(1, 6);
      this.lastRoll = value;
      this.dice.setValue(value);
      this.emit("roll", { value } satisfies RollEvent);
      return value;
    }

    // אם גלוי: אנימציה רגילה
    return this.rollAndEmit(durationMs);
  }

  private async rollAndEmit(durationMs: number) {
    const value = await this.dice.roll(durationMs);
    this.lastRoll = value;
    this.emit("roll", { value } satisfies RollEvent);
    return value;
  }

  destroy() {
    this.removeAllListeners();
    this.hitZone.destroy();
    this.dice.destroy();
  }
}