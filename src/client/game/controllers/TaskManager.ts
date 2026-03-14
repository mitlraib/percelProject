import Phaser from "phaser";
import MomController from "./MomController";
import CleanupPuzzle from "../ui/CleanupPuzzle";

type TaskManagerOpts = {
  taskSteps?: number[];
  onLockChange?: (locked: boolean) => void;
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
    console.log("[TASKS] destroy", {
      hadPuzzle: !!this.activePuzzle,
      ts: Date.now(),
    });

    this.activePuzzle?.destroy();
    this.activePuzzle = undefined;

    this.scene.input.topOnly = false;
  }

  handleAfterMove(playerIndex: number, stepsNow: number, done: () => void) {
    console.log("[TASKS] handleAfterMove start", {
      playerIndex,
      stepsNow,
      locked: this.locked,
      ts: Date.now(),
    });

    if (this.locked) {
      console.log("[TASKS] already locked -> done()", { ts: Date.now() });
      done();
      return;
    }

    const step = this.taskSteps.find((s) => s === stepsNow);
    if (!step) {
      console.log("[TASKS] no mom task on this step -> done()", {
        stepsNow,
        ts: Date.now(),
      });
      done();
      return;
    }

    if (this.opts.isBotPlayerIndex(playerIndex)) {
      console.log("[TASKS] bot landed on mom step -> done()", {
        playerIndex,
        step,
        ts: Date.now(),
      });
      done();
      return;
    }

    if (!this.opts.isLocalPlayerIndex(playerIndex)) {
      console.log("[TASKS] remote player landed on mom step -> markShown + done()", {
        playerIndex,
        step,
        ts: Date.now(),
      });
      this.mom.markShown(playerIndex, step);
      done();
      return;
    }

    if (this.mom.hasShown(playerIndex, step)) {
      console.log("[TASKS] mom step already shown -> done()", {
        playerIndex,
        step,
        ts: Date.now(),
      });
      done();
      return;
    }

    console.log("[TASKS] opening mom task", {
      playerIndex,
      step,
      ts: Date.now(),
    });

    this.mom.markShown(playerIndex, step);

    this.lockInternal();

    this.opts.onTaskOpened?.(playerIndex, "mom");

    const { x, y } = this.opts.getStepWorldXY(step);

    const height = this.scene.scale.height;
    const device = (this.scene as Phaser.Scene & { sys?: { game?: { device?: { os?: { android?: boolean; iOS?: boolean } } } } }).sys?.game?.device;
    const isMobile = !!(device?.os?.android || device?.os?.iOS);
    const momHeight = isMobile ? Math.min(140, Math.round(height * 0.20)) : Math.min(580, Math.round(height * 0.64));

    this.mom.showMomWithSpeech({
      x,
      y,
      depth: 400,
      targetHeightPx: momHeight,
      speechText: "אוי ! עוד יומיים פסח , אני אשמח לעזרה לסדר את הבית !",
    });

    this.scene.time.delayedCall(2000, () => {
      console.log("[TASKS] delayedCall after mom speech", {
        playerIndex,
        step,
        ts: Date.now(),
      });

      this.mom.hideAnimated(() => {
        console.log("[TASKS] mom.hideAnimated complete", {
          playerIndex,
          step,
          ts: Date.now(),
        });

        this.activePuzzle?.destroy();

        console.log("[TASKS] creating CleanupPuzzle", {
          playerIndex,
          step,
          ts: Date.now(),
        });

        this.activePuzzle = new CleanupPuzzle(this.scene, {
          depth: 25000,
          onComplete: () => {
            console.log("[TASKS] CleanupPuzzle onComplete", {
              playerIndex,
              step,
              ts: Date.now(),
            });

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
    console.log("[TASKS] lockInternal", { ts: Date.now() });
    this.opts.lock();
    this.opts.onLockChange?.(true);
  }

  private unlockInternal() {
    this.locked = false;
    console.log("[TASKS] unlockInternal", { ts: Date.now() });
    this.opts.unlock();
    this.opts.onLockChange?.(false);
  }
}