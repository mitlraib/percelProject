import Phaser from "phaser";
import WeddingSeatingCanon, { TableState } from "./WeddingSeatingCanon";
import WeddingSeatingIntro from "./WeddingSeatingIntro";
import WeddingSeatingBoardView from "./WeddingSeatingBoardView";
import WeddingSeatingGuestsController from "./WeddingSeatingGuestsController";
import WeddingSeatingTimer from "./WeddingSeatingTimer";
import type {
  WeddingSeatingTaskOpts,
  WeddingSeatingTaskResult,
  WeddingBoardRefs,
} from "./WeddingSeatingTypes";

export default class WeddingSeatingTask {
  private scene: Phaser.Scene;
  private canon: WeddingSeatingCanon;
  private opts: WeddingSeatingTaskOpts;

  private intro?: WeddingSeatingIntro;
  private board?: WeddingBoardRefs;
  private guestsCtl?: WeddingSeatingGuestsController;
  private timer?: WeddingSeatingTimer;

  private tables: TableState[] = [];
  private finished = false;

  constructor(scene: Phaser.Scene, opts: WeddingSeatingTaskOpts = {}) {
    this.scene = scene;
    this.opts = opts;
    this.canon = new WeddingSeatingCanon();
  }

  open() {
    const depth = this.opts.depth ?? 5000;

    this.intro = new WeddingSeatingIntro(this.scene, depth);
    this.intro.open(() => {
      this.buildTaskUI();
    });
  }

  private buildTaskUI() {
    if (this.board) return;

    const depth = this.opts.depth ?? 5000;

    // ברירת מחדל קשיחה של 90 שניות
    const durationSec = 90;

    this.tables = this.canon.createEmptyTables();
    this.finished = false;

    const boardBuilder = new WeddingSeatingBoardView(
      this.scene,
      this.canon,
      depth,
      durationSec
    );

    this.board = boardBuilder.build(() => {
      if (!this.finished) {
        this.submit();
      }
    });

    this.guestsCtl = new WeddingSeatingGuestsController(this.scene, this.canon, {
      depth: depth + 3,
      root: this.board.root,
      seats: this.board.seats,
      tables: this.tables,
      statusText: this.board.statusText,
      finished: () => this.finished,
    });

    this.guestsCtl.build(this.board.panel);

    this.timer = new WeddingSeatingTimer(
      this.scene,
      this.board.timerText,
      durationSec
    );

    this.timer.start(() => {
      if (!this.finished) {
        this.finish({ ok: false, reason: "timeout" });
      }
    });
  }

  private submit() {
    if (this.finished || !this.board) return;

    const result = this.canon.validate(this.tables);

    if (!result.ok) {
      this.board.statusText.setColor("#b00020");
      this.board.statusText.setText(result.message);

      this.scene.tweens.add({
        targets: this.board.statusText,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 90,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
      });

      const baseX = this.board.panel.x;

      this.scene.tweens.add({
        targets: this.board.panel,
        x: baseX + 6,
        duration: 45,
        yoyo: true,
        repeat: 3,
        ease: "Sine.easeInOut",
        onComplete: () => {
          if (this.board) {
            this.board.panel.x = baseX;
          }
        },
      });

      return;
    }

    this.board.statusText.setColor("#1f6f3f");
    this.board.statusText.setText(result.message);

    this.scene.time.delayedCall(600, () => {
      this.finish({ ok: true });
    });
  }

  private finish(result: WeddingSeatingTaskResult) {
    if (this.finished) return;
    this.finished = true;

    this.timer?.stop();

    const targets: Phaser.GameObjects.GameObject[] = [];

    if (this.board) {
      targets.push(
        this.board.backdrop,
        this.board.panel,
        this.board.titleText,
        this.board.rulesText,
        this.board.timerText,
        this.board.statusText,
        this.board.root,
        this.board.submitBtnBg,
        this.board.submitBtnLabel
      );
    }

    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 200,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.destroy();
        this.opts.onComplete?.(result);
      },
    });
  }

  destroy() {
    this.timer?.destroy();
    this.timer = undefined;

    this.guestsCtl?.destroy();
    this.guestsCtl = undefined;

    this.intro?.destroy();
    this.intro = undefined;

    this.board?.root?.destroy(true);
    this.board?.backdrop?.destroy();
    this.board?.panel?.destroy();
    this.board?.titleText?.destroy();
    this.board?.rulesText?.destroy();
    this.board?.timerText?.destroy();
    this.board?.statusText?.destroy();
    this.board?.submitBtnBg?.destroy();
    this.board?.submitBtnLabel?.destroy();
    this.board = undefined;

    this.tables = [];
  }
}