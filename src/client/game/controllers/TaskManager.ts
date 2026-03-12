import Phaser from "phaser";
import MomController from "./MomController";
import CleanupPuzzle from "../ui/CleanupPuzzle";

type TaskManagerOpts = {
  taskSteps?: number[]; // default [3,10]
  onLockChange?: (locked: boolean) => void;
  /** נקרא כשמשימת אמא נפתחת אצל השחקן המקומי (לשליחה לרשת) */
  onTaskOpened?: (playerIndex: number, type: "mom") => void;

  isBotPlayerIndex: (playerIndex: number) => boolean;
  isLocalPlayerIndex: (playerIndex: number) => boolean;

  getStepWorldXY: (step: number) => { x: number; y: number };

  lock: () => void;
  unlock: () => void;
};

export default class TaskManager {
  private scene: Phaser.Scene;
  private mom: MomController;
  private opts: TaskManagerOpts;

  private taskSteps: number[];
  private locked = false;

  private activePuzzle?: CleanupPuzzle;

  constructor(scene: Phaser.Scene, mom: MomController, opts: TaskManagerOpts) {
    this.scene = scene;
    this.mom = mom;
    this.opts = opts;
    this.taskSteps = opts.taskSteps ?? [3, 10];
  }

  isLocked() {
    return this.locked;
  }

  destroy() {
    this.activePuzzle?.destroy();
    this.activePuzzle = undefined;

    // CleanupPuzzle מדליק topOnly, נחזיר
    this.scene.input.topOnly = false;
  }

  /**
   * לקרוא אחרי שהתזוזה נגמרה.
   * done תמיד נקרא: או מיד (אין משימה), או אחרי הפאזל.
   */
  handleAfterMove(playerIndex: number, stepsNow: number, done: () => void) {
    // ✅ תיקון: גם אם locked, אסור להשאיר את התור "פתוח"
    if (this.locked) {
      done();
      return;
    }

    const step = this.taskSteps.find((s) => s === stepsNow);
    if (!step) {
      done();
      return;
    }

    // SOLO: אם בוט הגיע ל-3/10 -> ממשיכים בלי אמא/פאזל
    if (this.opts.isBotPlayerIndex(playerIndex)) {
      done();
      return;
    }

    // MULTI: רק הקליינט של אותו שחקן פותח פאזל
    if (!this.opts.isLocalPlayerIndex(playerIndex)) {
      this.mom.markShown(playerIndex, step);
      done();
      return;
    }

    if (this.mom.hasShown(playerIndex, step)) {
      done();
      return;
    }

    this.mom.markShown(playerIndex, step);

    this.lockInternal();

    this.opts.onTaskOpened?.(playerIndex, "mom");

    const { x, y } = this.opts.getStepWorldXY(step);

    this.mom.showMomWithSpeech({
      x,
      y,
      depth: 400,
      targetHeightPx: 400,
      speechText: "אוי ! עוד יומיים פסח , אני אשמח לעזרה לסדר את הבית !",
    });

    this.scene.time.delayedCall(2000, () => {
      this.mom.hideAnimated(() => {
        this.activePuzzle?.destroy();

        this.activePuzzle = new CleanupPuzzle(this.scene, {
          depth: 25000,
          onComplete: () => {
            this.activePuzzle = undefined;

            this.scene.input.topOnly = false;

            this.unlockInternal();
            done();
          },
        });
      });
    });
  }

  private lockInternal() {
    this.locked = true;
    this.opts.lock();
    this.opts.onLockChange?.(true);
  }

  private unlockInternal() {
    this.locked = false;
    this.opts.unlock();
    this.opts.onLockChange?.(false);
  }
}