import Phaser from "phaser";
import type NetGameController from "../../controllers/NetGameController";
import WeddingSeatingTask from "../../controllers/wedding/WeddingSeatingTask";
import type { Mode } from "./ParallaxTypes";

type TaskFlowOpts = {
  scene: Phaser.Scene;
  mode: Mode;
  getMyIndex: () => number | null;
  getNet: () => NetGameController | undefined;
  lockForTask: () => void;
  unlockAfterTask: () => void;
  followMyPlayer: (delay?: number) => void;
  showSmallStatus: (message: string) => void;
  onPenaltyLocal: (playerIndex: number, deltaSteps: number, done: () => void) => void;
  onRefreshHud: () => void;
};

export default class ParallaxTaskFlowController {
  private scene: Phaser.Scene;
  private opts: TaskFlowOpts;

  private seatingTask?: WeddingSeatingTask;
  private readonly seatingTaskSteps = [15, 22];
  private readonly seatingTriggered = new Set<string>();

  constructor(opts: TaskFlowOpts) {
    this.scene = opts.scene;
    this.opts = opts;
  }

  hasActiveSeatingTask() {
    return !!this.seatingTask;
  }

  destroy() {
    this.seatingTask?.destroy();
    this.seatingTask = undefined;
    this.seatingTriggered.clear();
  }

  handleWeddingSeatingAfterMove(
    playerIndex: number,
    stepsNow: number,
    done: () => void
  ) {
    if (this.seatingTask) {
      done();
      return;
    }

    if (!this.seatingTaskSteps.includes(stepsNow)) {
      done();
      return;
    }

    const triggerKey = `${playerIndex}:${stepsNow}`;
    if (this.seatingTriggered.has(triggerKey)) {
      done();
      return;
    }

    if (this.opts.mode === "solo" && playerIndex === 1) {
      this.seatingTriggered.add(triggerKey);
      this.scene.time.delayedCall(250, () => done());
      return;
    }

    const net = this.opts.getNet();
    if (net) {
      const me = this.opts.getMyIndex();
      if (me === null || me !== playerIndex) {
        done();
        return;
      }
    }

    this.seatingTriggered.add(triggerKey);
    this.opts.lockForTask();

    // מודיעים לשרת שהמשימה של אבא נפתחה אצל השחקן הזה
    if (net) {
      try {
        net.sendTaskStarted("dad");
      } catch {}
    }

    this.seatingTask = new WeddingSeatingTask(this.scene, {
      depth: 7000,
      durationSec: 60,
      onComplete: (result) => {
        this.seatingTask = undefined;
        this.opts.unlockAfterTask();

        if (result.ok) {
          this.opts.showSmallStatus("ההושבה הצליחה 🎉");
          this.opts.onRefreshHud();
          this.opts.followMyPlayer(80);

          this.scene.time.delayedCall(90, () => done());
          return;
        }

        if (result.reason === "timeout") {
          this.opts.showSmallStatus("נגמר הזמן - חוזרים 3 צעדים ⏪");
        } else if (result.reason === "closed") {
          this.opts.showSmallStatus("הסידור נכשל - חוזרים 3 צעדים ⏪");
        } else {
          this.opts.showSmallStatus("סידור השולחנות נכשל - חוזרים 3 צעדים ⏪");
        }

        const currentNet = this.opts.getNet();
        if (currentNet) {
          currentNet.sendPenalty(-3);
          this.opts.followMyPlayer(120);
          this.scene.time.delayedCall(130, () => done());
          return;
        }

        this.opts.onPenaltyLocal(playerIndex, -3, () => {
          this.opts.followMyPlayer(80);
          done();
        });
      },
    });

    this.seatingTask.open();
  }
}