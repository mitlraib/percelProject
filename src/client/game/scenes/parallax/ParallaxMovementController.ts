import Phaser from "phaser";
import PlayerManager from "../../controllers/PlayerManager";
import CameraController from "../../controllers/CameraController";
import SceneUI from "../../controllers/SceneUI";
import TaskManager from "../../controllers/TaskManager";
import NoamTaskManager from "../../controllers/NoamTaskManager";
import ParallaxTaskFlowController from "./ParallaxTaskFlowController";

type MovementControllerOpts = {
  moveMs: number;
  getLaneStartX: () => number;
  getStepSizePx: () => number;
  getMyIndex: () => number | null;
  refreshHUD: () => void;
};

export class ParallaxMovementController {
  private scene: Phaser.Scene;
  private players: PlayerManager;
  private camCtl: CameraController;
  private ui: SceneUI;
  private tasks: TaskManager;
  private noamTasks: NoamTaskManager;
  private taskFlow: ParallaxTaskFlowController;
  private opts: MovementControllerOpts;

  constructor(
    scene: Phaser.Scene,
    players: PlayerManager,
    camCtl: CameraController,
    ui: SceneUI,
    tasks: TaskManager,
    noamTasks: NoamTaskManager,
    taskFlow: ParallaxTaskFlowController,
    opts: MovementControllerOpts
  ) {
    this.scene = scene;
    this.players = players;
    this.camCtl = camCtl;
    this.ui = ui;
    this.tasks = tasks;
    this.noamTasks = noamTasks;
    this.taskFlow = taskFlow;
    this.opts = opts;
  }

  playMoveTurn(
    playerIndex: number,
    diceValue: number,
    onTurnFinished?: () => void
  ) {
    this.ui.setLastRoll(diceValue);
    this.ui.setMoving(true);

    this.players.moveByDice({
      playerIndex,
      diceValue,
      laneStartX: this.opts.getLaneStartX(),
      stepSizePx: this.opts.getStepSizePx(),
      maxX: this.camCtl.getMaxXPadding(40),
      duration: this.opts.moveMs,
      onComplete: () => {
        this.ui.setMoving(false);

        const stepsNow = this.players.getSteps(playerIndex);

        this.tasks.handleAfterMove(playerIndex, stepsNow, () => {
          this.taskFlow.handleWeddingSeatingAfterMove(
            playerIndex,
            stepsNow,
            () => {
              this.noamTasks.handleAfterMove(playerIndex, stepsNow, () => {
                const followIdx = this.opts.getMyIndex() ?? 0;

                this.opts.refreshHUD();

                this.scene.time.delayedCall(100, () => {
                  this.camCtl.follow(this.players.getContainer(followIdx));
                });

                this.ui.flushPendingDiceVisibility();
                onTurnFinished?.();
              });
            }
          );
        });
      },
    });
  }

  playPenaltyMove(
    playerIndex: number,
    deltaSteps: number,
    done?: () => void
  ) {
    this.ui.setMoving(true);

    this.players.moveByDice({
      playerIndex,
      diceValue: deltaSteps,
      laneStartX: this.opts.getLaneStartX(),
      stepSizePx: this.opts.getStepSizePx(),
      maxX: this.camCtl.getMaxXPadding(40),
      duration: 1300,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.ui.setMoving(false);

        const followIdx = this.opts.getMyIndex() ?? 0;

        this.scene.time.delayedCall(80, () => {
          this.camCtl.follow(this.players.getContainer(followIdx));
        });

        this.opts.refreshHUD();
        done?.();
      },
    });
  }
}

export default ParallaxMovementController;