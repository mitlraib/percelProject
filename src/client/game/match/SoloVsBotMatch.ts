import Phaser from "phaser";
import type DiceRollerCanvas from "../ui/DiceRollerCanvas";

export type Player = {
  id: "human" | "bot";
  name: string;
  emoji: string;
  isBot: boolean;
};

export default class SoloVsBotMatch extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private dice: DiceRollerCanvas;

  private players: Player[];
  private currentIndex = 0;

  private diceListener?: (payload: { value: number }) => void;

  private paused = false;
  private botTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, dice: DiceRollerCanvas, human: { name: string; emoji: string }) {
    super();
    this.scene = scene;
    this.dice = dice;

    this.players = [
      { id: "human", name: human.name, emoji: human.emoji, isBot: false },
      { id: "bot", name: "בוטית רעה", emoji: "🤖", isBot: true },
    ];
  }

  start() {
    this.diceListener = (payload: { value: number }) => this.onDiceRolled(payload.value);
    this.dice.onRoll(this.diceListener);
    this.refreshTurnUI();
  }

  destroy() {
    if (this.botTimer) {
      this.botTimer.remove(false);
      this.botTimer = undefined;
    }

    if (this.diceListener) {
      this.dice.off("roll", this.diceListener);
      this.diceListener = undefined;
    }

    this.removeAllListeners();
  }

  setPaused(paused: boolean) {
    this.paused = paused;

    if (this.botTimer) {
      this.botTimer.remove(false);
      this.botTimer = undefined;
    }

    if (!this.paused) {
      this.refreshTurnUI();
    } else {
      this.dice.setDisabled(true);
    }
  }

  advanceTurn() {
    this.currentIndex = (this.currentIndex + 1) % this.players.length;
    this.refreshTurnUI();
  }

  private get currentPlayer(): Player {
    return this.players[this.currentIndex];
  }

  private refreshTurnUI() {
    const p = this.currentPlayer;

    this.dice.setPlayer(p.name, p.emoji);
    this.emit("turn-changed", { player: p });

    if (this.paused) {
      this.dice.setDisabled(true);
      return;
    }

    if (p.isBot) {
      // חוסמים את המשתמש
      this.dice.setDisabled(true);

      if (this.botTimer) {
        this.botTimer.remove(false);
        this.botTimer = undefined;
      }

      this.botTimer = this.scene.time.delayedCall(700, async () => {
        if (this.paused) return;
        if (this.currentPlayer.id !== "bot") return;

        // מאפשר לבוט לגלגל גם אם disabled
        const wasDisabled = this.dice.isDisabled();
        this.dice.setDisabled(false);

        try {
          await this.dice.rollForced(800);
        } finally {
          this.dice.setDisabled(wasDisabled);
        }
      });
    } else {
      // תור אדם
      this.dice.setDisabled(false);
    }
  }

  private onDiceRolled(value: number) {
    const p = this.currentPlayer;
    this.emit("dice-rolled", { player: p, value });
  }
}