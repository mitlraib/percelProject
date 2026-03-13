// src/client/game/controllers/NoamTaskManager.ts
import Phaser from "phaser";

import NoamNpcView from "./noam/NoamNpcView";
import VendorsCanon from "./noam/VendorsCanon";
import VendorsTaskUI, { type VendorsTaskUIResult } from "./noam/VendorsTaskUI";

type NoamTaskManagerOpts = {
  steps?: number[];

  /** נקרא כשמשימת נועם נפתחת אצל השחקן המקומי (לשליחה לרשת) */
  onTaskOpened?: (playerIndex: number, type: "noam") => void;

  isBotPlayerIndex: (playerIndex: number) => boolean;
  isLocalPlayerIndex: (playerIndex: number) => boolean;

  getStepWorldXY: (step: number) => { x: number; y: number };

  lock: () => void;
  unlock: () => void;

  onFailPenalty: (playerIndex: number, deltaSteps: number, done: () => void) => void;
};

export default class NoamTaskManager {
  private scene: Phaser.Scene;
  private opts: NoamTaskManagerOpts;

  private readonly steps: number[];
  private locked = false;

  // לכל שחקן: אילו שלבים כבר הוצגו (27, 30)
  private shownStepsByPlayer = new Map<number, Set<number>>();

  private npc: NoamNpcView;
  private ui: VendorsTaskUI;

  // הגנה כדי שלא נקרא done פעמיים
  private pendingDone?: () => void;
  private finished = false;

  constructor(scene: Phaser.Scene, opts: NoamTaskManagerOpts) {
    this.scene = scene;
    this.opts = opts;

    this.steps = opts.steps ?? [27, 30];

    this.npc = new NoamNpcView(scene);
    const canon = new VendorsCanon();
    this.ui = new VendorsTaskUI(scene, canon);
  }

  isLocked() {
    return this.locked;
  }

  /** מציג אצל שאר השחקנים: נועם עם הודעה "X עוזר לי כרגע... מיד יתפנה אליכן" ונעלם אחרי 3 שניות */
  showBusyMessage(playerName: string) {
    const { x, y } = this.opts.getStepWorldXY(27);
    this.npc.show({
      x,
      y,
      depth: 400,
      targetHeightPx: 400,
      speechText: `${playerName} עוזרת לי כרגע... מיד היא תתפנה אליכן.`,
    });
    this.scene.time.delayedCall(3000, () => this.npc.hideAll());
  }

  destroy() {
    this.safeFinishIfNeeded();
    this.ui.cleanup();
    this.npc.destroy();
    this.shownStepsByPlayer.clear();
  }

  handleAfterMove(playerIndex: number, stepsNow: number, done: () => void) {
    // תמיד לא לחסום שרשרת תורות
    if (this.locked) {
      done();
      return;
    }

    const step = this.steps.find((s) => s === stepsNow);
    if (!step) {
      done();
      return;
    }

    // בוט לא עושה משימה
    if (this.opts.isBotPlayerIndex(playerIndex)) {
      done();
      return;
    }

    // אם זה לא השחקן המקומי — לא פותחים UI
    if (!this.opts.isLocalPlayerIndex(playerIndex)) {
      this.markShown(playerIndex, step);
      done();
      return;
    }

    // כבר הוצג בעבר לשחקן הזה
    if (this.hasShown(playerIndex, step)) {
      done();
      return;
    }

    this.markShown(playerIndex, step);
    this.runTaskFlow(playerIndex, step, done);
  }

  // ---------------- private ----------------

  private hasShown(playerIndex: number, step: number) {
    return this.shownStepsByPlayer.get(playerIndex)?.has(step) ?? false;
  }

  private markShown(playerIndex: number, step: number) {
    if (!this.shownStepsByPlayer.has(playerIndex)) {
      this.shownStepsByPlayer.set(playerIndex, new Set<number>());
    }
    this.shownStepsByPlayer.get(playerIndex)!.add(step);
  }

  private runTaskFlow(playerIndex: number, stepForPos: number, done: () => void) {
    this.finished = false;
    this.pendingDone = done;

    this.lockInternal();

    this.opts.onTaskOpened?.(playerIndex, "noam");

    const { x, y } = this.opts.getStepWorldXY(stepForPos);

    this.npc.show({
      x,
      y,
      depth: 400,
      targetHeightPx: 400,
      speechText: "אוי! תכף החתונה! אני זקוק לעזרה בלסגור ספקים לחתונה!",
    });

    // אחרי 2 שניות פותחים את המשימה
    this.scene.time.delayedCall(2000, async () => {
      if (this.finished) return;

      this.npc.hideSpeechOnly();

      const taskTimeoutMs = 65_000;
      const result = await Promise.race([
        this.ui.run({ seconds: 60, needCount: 10 }),
        new Promise<VendorsTaskUIResult>((_, reject) =>
          this.scene.time.delayedCall(taskTimeoutMs, () => reject(new Error("Noam task timeout")))
        ),
      ]).catch(() => ({ ok: false as const, found: [] }));

      if (this.finished) return;

      if (result.ok) {
        this.win();
        return;
      }

      this.fail(playerIndex);
    });
  }

  private win() {
    this.ui.cleanup();
    this.npc.hideAll();

    // הודעת הצלחה קצרה ואז שחרור
    this.showToastCenter("אלופה! סידרת את כל הספקים! כולם מוכנים כבר לחתונה !", () => {
      this.unlockInternal();
      this.finishAndContinue();
    });
  }

  private fail(playerIndex: number) {
    this.ui.cleanup();
    this.npc.hideAll();

    // כישלון: קודם מריצים עונש, ורק כשהוא מסיים ממשיכים את שרשרת התור
    const onPenaltyDone = () => {
      this.unlockInternal();
      this.finishAndContinue();
    };

    try {
      this.opts.onFailPenalty(playerIndex, -3, onPenaltyDone);
    } catch {
      // אם משהו קרה ב־onFailPenalty, לפחות לא ניתקע
      onPenaltyDone();
    }
  }

  private lockInternal() {
    this.locked = true;
    this.opts.lock();
  }

  private unlockInternal() {
    this.locked = false;
    this.opts.unlock();
  }

  private finishAndContinue() {
    if (this.finished) return;
    this.finished = true;

    const done = this.pendingDone;
    this.pendingDone = undefined;

    // ✅ תמיד ממשיכים את שרשרת התור
    done?.();
  }

  private safeFinishIfNeeded() {
    if (!this.finished && this.pendingDone) {
      this.unlockInternal();
      this.finishAndContinue();
    }
  }

  private showToastCenter(text: string, onDone: () => void) {
    const depth = 30000;

    const c = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height / 2);
    c.setDepth(depth).setScrollFactor(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.lineStyle(3, 0x111111, 0.9);
    bg.fillRoundedRect(-280, -42, 560, 84, 18);
    bg.strokeRoundedRect(-280, -42, 560, 84, 18);

    const t = this.scene.add
      .text(0, 0, text, {
        fontFamily: "Arial Black",
        fontSize: "20px",
        color: "#111",
        align: "center",
        wordWrap: { width: 520, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0.5);

    c.add([bg, t]);
    c.setAlpha(0);
    c.setScale(0.95);

    this.scene.tweens.add({
      targets: c,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.scene.time.delayedCall(1100, () => {
          this.scene.tweens.add({
            targets: c,
            alpha: 0,
            duration: 140,
            onComplete: () => {
              c.destroy(true);
              onDone();
            },
          });
        });
      },
    });
  }
}