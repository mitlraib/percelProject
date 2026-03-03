import Phaser from "phaser";
import HudController from "./HudController";
import DiceRollerCanvas from "../ui/DiceRollerCanvas";

export default class SceneUI {
  private scene: Phaser.Scene;

  public hud: HudController;
  public dice: DiceRollerCanvas;

  private isMoving = false;
  private pendingDiceVisible: boolean | null = null;

  constructor(
    scene: Phaser.Scene,
    opts: {
      diceX: number;
      diceY: number;
      diceDepth?: number;
      diceSize?: number;
      initialName?: string;
      initialEmoji?: string;
    }
  ) {
    this.scene = scene;

    this.hud = new HudController(scene);

    this.dice = new DiceRollerCanvas(scene, {
      x: opts.diceX,
      y: opts.diceY,
      scrollFactor: 0,
      depth: opts.diceDepth ?? 10000,
      size: opts.diceSize ?? 64,
      currentPlayerName: opts.initialName ?? "",
      currentPlayerEmoji: opts.initialEmoji ?? "🎲",
    });
  }

  destroy() {
    this.hud.destroy();
    this.dice.destroy();
  }

  resize() {
    this.hud.resize();
  }

  setHUD(myLine: string, turnLine: string) {
    this.hud.setText(myLine, turnLine);
  }

  setDicePlayer(name: string, emoji: string) {
    this.dice.setPlayer(name, emoji);
  }

  setLastRoll(v: number) {
    this.dice.setLastRoll(v);
  }

  isDiceDisabled() {
    return this.dice.isDisabled();
  }

  setDiceDisabled(v: boolean) {
    this.dice.setDisabled(v);
  }

  setMoving(v: boolean) {
    this.isMoving = v;
  }

  setDiceVisibleDeferred(visible: boolean) {
    // בזמן תזוזה: אם מסתירים, דוחים לסוף
    if (this.isMoving && visible === false) {
      this.pendingDiceVisible = false;
      return;
    }

    // בזמן תזוזה: להציג מותר, אבל לא לדרוס "הסתר בסוף" אם עוד לא הוחלט
    if (this.isMoving && visible === true) {
      this.pendingDiceVisible = null;
      this.dice.setVisible(true);
      return;
    }

    this.pendingDiceVisible = null;
    this.dice.setVisible(visible);
  }

  flushPendingDiceVisibility() {
    if (this.pendingDiceVisible === null) return;
    const v = this.pendingDiceVisible;
    this.pendingDiceVisible = null;
    this.dice.setVisible(v);
  }
}