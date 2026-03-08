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

  private x: number;
  private y: number;
  private size: number;
  private scrollFactor: number;
  private depth: number;

  constructor(scene: Phaser.Scene, cfg: DiceRollerCanvasCfg) {
    super();
    this.scene = scene;

    this.x = cfg.x;
    this.y = cfg.y;
    this.size = cfg.size ?? 64;
    this.scrollFactor = cfg.scrollFactor ?? 0;
    this.depth = cfg.depth ?? 10000;

    this.playerName = cfg.currentPlayerName ?? "";
    this.playerEmoji = cfg.currentPlayerEmoji ?? "🎲";

    this.dice = new DiceCanvas(scene, this.x, this.y, this.size)
      .setScrollFactor(this.scrollFactor)
      .setDepth(this.depth);

    this.hitZone = scene.add
      .zone(this.x, this.y, this.getHitSize(), this.getHitSize())
      .setScrollFactor(this.scrollFactor)
      .setDepth(this.depth + 1)
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

    this.hitZone.disableInteractive();
    if (!v) {
      this.hitZone.setInteractive({ useHandCursor: true });
    }

    this.dice.setAlpha(v ? 0.65 : 1);
  }

  isVisible() {
    return this.dice.visible;
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

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;

    this.dice.setDicePosition(x, y);
    this.hitZone.setPosition(x, y);
  }

  setSize(size: number) {
    this.size = Math.max(48, Math.round(size));
    this.dice.setDiceSize(this.size);
    this.hitZone.setSize(this.getHitSize(), this.getHitSize());
  }

  resize(x: number, y: number, size: number) {
    this.setSize(size);
    this.setPosition(x, y);
  }

  private getHitSize() {
    return this.size + Math.max(30, Math.round(this.size * 0.45));
  }

  tryRollFromInput() {
    if (this.disabled) return;
    if (!this.dice.visible) return;
    if (this.dice.isRolling()) return;

    this.rollAndEmit(800);
  }

  async roll(durationMs = 800): Promise<number> {
    if (this.disabled) return this.lastRoll || this.dice.getValue();
    if (!this.dice.visible) return this.lastRoll || this.dice.getValue();
    if (this.dice.isRolling()) return this.lastRoll || this.dice.getValue();

    return this.rollAndEmit(durationMs);
  }

  async rollForced(durationMs = 800): Promise<number> {
    if (this.dice.isRolling()) return this.lastRoll || this.dice.getValue();

    if (!this.dice.visible) {
      const value = Phaser.Math.Between(1, 6);
      this.lastRoll = value;
      this.dice.setValue(value);
      this.emit("roll", { value } satisfies RollEvent);
      return value;
    }

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