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
  private visibleFlag = true;
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
      .setDepth(this.depth + 1);

    this.hitZone.on("pointerdown", () => {
      console.log("[CLIENT][DiceRollerCanvas] pointerdown on hitZone", {
        disabled: this.disabled,
        visibleFlag: this.visibleFlag,
        diceVisible: this.dice.visible,
        isRolling: this.dice.isRolling(),
        ts: Date.now(),
      });

      this.tryRollFromInput();
    });

    this.refreshInteractivity();
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

    console.log("[CLIENT][DiceRollerCanvas] setDisabled", {
      disabled: v,
      visibleFlag: this.visibleFlag,
      ts: Date.now(),
    });

    this.dice.setAlpha(v ? 0.65 : 1);
    this.refreshInteractivity();
  }

  isVisible() {
    return this.visibleFlag;
  }

  setVisible(v: boolean) {
    this.visibleFlag = v;

    console.log("[CLIENT][DiceRollerCanvas] setVisible", {
      visible: v,
      disabled: this.disabled,
      ts: Date.now(),
    });

    this.dice.setVisible(v);
    this.hitZone.setVisible(v);
    this.refreshInteractivity();
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

  private refreshInteractivity() {
    const shouldBeInteractive = this.visibleFlag && !this.disabled;

    console.log("[CLIENT][DiceRollerCanvas] refreshInteractivity", {
      shouldBeInteractive,
      visibleFlag: this.visibleFlag,
      disabled: this.disabled,
      ts: Date.now(),
    });

    this.hitZone.disableInteractive();

    if (shouldBeInteractive) {
      this.hitZone.setInteractive({ useHandCursor: true });
    }
  }

  tryRollFromInput() {
    console.log("[CLIENT][DiceRollerCanvas] tryRollFromInput", {
      disabled: this.disabled,
      visibleFlag: this.visibleFlag,
      diceVisible: this.dice.visible,
      isRolling: this.dice.isRolling(),
      ts: Date.now(),
    });

    if (this.disabled) return;
    if (!this.visibleFlag) return;
    if (!this.dice.visible) return;
    if (this.dice.isRolling()) return;

    const value = Phaser.Math.Between(1, 6);
    this.lastRoll = value;

    this.emit("roll", { value } satisfies RollEvent);
    this.dice.playVisualRoll(value, 300);
  }

  async roll(durationMs = 300): Promise<number> {
    if (this.disabled) return this.lastRoll || this.dice.getValue();
    if (!this.visibleFlag) return this.lastRoll || this.dice.getValue();
    if (!this.dice.visible) return this.lastRoll || this.dice.getValue();
    if (this.dice.isRolling()) return this.lastRoll || this.dice.getValue();

    const value = Phaser.Math.Between(1, 6);
    this.lastRoll = value;
    this.emit("roll", { value } satisfies RollEvent);
    this.dice.playVisualRoll(value, durationMs);
    return value;
  }

  async rollForced(durationMs = 300): Promise<number> {
    if (this.dice.isRolling()) return this.lastRoll || this.dice.getValue();

    const value = Phaser.Math.Between(1, 6);
    this.lastRoll = value;
    this.emit("roll", { value } satisfies RollEvent);
    this.dice.playVisualRoll(value, durationMs);
    return value;
  }

  destroy() {
    this.removeAllListeners();
    this.hitZone.destroy();
    this.dice.destroy();
  }
}