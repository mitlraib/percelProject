// src/client/game/controllers/NoamTaskManager.ts
import Phaser from "phaser";

type NoamTaskManagerOpts = {
  steps?: number[];

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

  private steps: number[];
  private locked = false;

  private shownStepsByPlayer = new Map<number, Set<number>>();

  private noam?: Phaser.GameObjects.Image;
  private speech?: Phaser.GameObjects.Container;

  private uiRoot?: Phaser.GameObjects.Container;
  private timerText?: Phaser.GameObjects.Text;
  private inputText?: Phaser.GameObjects.Text;
  private listText?: Phaser.GameObjects.Text;

  private remaining = 60;
  private timerEvent?: Phaser.Time.TimerEvent;

  private currentInput = "";
  private found = new Set<string>();

  private pendingDone?: () => void;

  private allowedCanon = new Set<string>([
    "צלם",
    "מאפרת",
    "איפור",
    "תסרוקת",
    "שיער",
    "תסרוקאית",
    "מעצבת שיער",
    "לק",
    "לק ג'ל",
    "ציפורניים",
    "מניקור",
    "פדיקור",
    "מניקוריסטית",
    "מנהל אירוע",
    "די ג'יי",
    "dj",
    "מוזיקאי",
    "זמר",
    "להקה",
    "רב",
    "מפיקה",
    "מסדרת פרחים",
    "מעצבת",
    "מעצב",
    "מעצבת אירוע",
    "מעצב אירוע",
    "צלם מגנטים",
    "צלמת מגנטים",
    "רובוט",
    "תאורה",
    "הגברה",
    "מלצרים",
    "ברמנים",
    "בר",
    "בר שתייה",
    "שתיה",
    "שתייה",
    "אלכוהול",
    "מעצבת שולחנות",
    "מעצבת חופה",
    "עיצוב פרחים",
    "מעצבת פרחים",
    "מעצב פרחים",
    "מעצב שולחנות",
    "מעצב חופה",
    "מעצבת פנים",
    "מעצב פנים",
    "מעצב רכב",
    "מעצבת רכב",
    "מאפרת כלה",
    "ספרית כלה",
    "השכרת רכב",
    "עיצוב רכב",
    "בלנית",
    "מקווה",
    "טבילה",
    "מדריכת כלות",
    "מדריך חתנים",
    "הדרכת כלות וחתנים",
    "הדרכת כלות",
    "הדרכת חתנים",
    "שמלת כלה",
    "חליפת חתן",
    "מוכרת שמלת כלה",
    "מוכרת בסלון כלות",
    "טיפול פנים",
    "השכרת מלון",
    "השכרת חדר במלון",
    "בעל אולם",
    "אולם",
    "חדר",
    "מלון",
    "חדר מלון",
  ]);

  constructor(scene: Phaser.Scene, opts: NoamTaskManagerOpts) {
    this.scene = scene;
    this.opts = opts;
    this.steps = opts.steps ?? [27, 30];
  }

  isLocked() {
    return this.locked;
  }

  destroy() {
    this.stopTimer();
    this.hideNoam();
    this.destroyTaskUI();
    this.scene.input.keyboard?.removeAllListeners();
  }

  handleAfterMove(playerIndex: number, stepsNow: number, done: () => void) {
    if (this.locked) return;

    const step = this.steps.find((s) => s === stepsNow);
    if (!step) {
      done();
      return;
    }

    if (this.opts.isBotPlayerIndex(playerIndex)) {
      done();
      return;
    }

    if (!this.opts.isLocalPlayerIndex(playerIndex)) {
      this.markShown(playerIndex, step);
      done();
      return;
    }

    if (this.hasShown(playerIndex, step)) {
      done();
      return;
    }

    this.markShown(playerIndex, step);
    this.lockInternal();

    const { x, y } = this.opts.getStepWorldXY(step);

    this.showNoamWithSpeech({
      x,
      y,
      targetHeightPx: 600, // ✅ ביקשת 600px
      depth: 500,
      speechText: "אוי ! תכף החתונה ! אני זקוק לעזרה בלסגור ספקים לחתונה !",
    });

    this.scene.time.delayedCall(2000, () => {
      this.hideSpeechBubbleOnly();
      this.startVendorsTask(playerIndex, done);
    });
  }

  // ---------- shown state ----------

  private hasShown(playerIndex: number, step: number) {
    return this.shownStepsByPlayer.get(playerIndex)?.has(step) ?? false;
  }

  private markShown(playerIndex: number, step: number) {
    if (!this.shownStepsByPlayer.has(playerIndex)) {
      this.shownStepsByPlayer.set(playerIndex, new Set<number>());
    }
    this.shownStepsByPlayer.get(playerIndex)!.add(step);
  }

  // ---------- NOAM visuals ----------

  private showNoamWithSpeech(params: {
    x: number;
    y: number;
    depth: number;
    targetHeightPx: number;
    speechText: string;
  }) {
    const { x, y, depth, targetHeightPx, speechText } = params;

    if (!this.noam) {
      this.noam = this.scene.add.image(x, y, "NOAM").setOrigin(0.5, 1).setDepth(depth);
    } else {
      this.noam.setPosition(x, y).setVisible(true).setDepth(depth);
    }

    const tex = this.noam.texture.getSourceImage() as HTMLImageElement;
    const ratio = tex.width / tex.height || 1;
    this.noam.setDisplaySize(targetHeightPx * ratio, targetHeightPx);

    this.noam.setAlpha(0);
    this.scene.tweens.add({
      targets: this.noam,
      alpha: 1,
      duration: 220,
      ease: "Sine.easeOut",
      onComplete: () => this.showSpeechBubble(speechText, depth + 1),
    });
  }

  private showSpeechBubble(text: string, depth: number) {
    if (!this.noam) return;

    this.hideSpeechBubbleOnly();

    const noam = this.noam;

    const bubbleX = noam.x + noam.displayWidth * 0.45;
    const bubbleY = noam.y - noam.displayHeight * 0.75;

    const paddingX = 18;
    const paddingY = 14;

    const t = this.scene.add
      .text(0, 0, text, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
        align: "right",
        wordWrap: { width: 360, useAdvancedWrap: true },
      })
      .setOrigin(1, 0);

    const bg = this.scene.add.graphics();
    const w = t.width + paddingX * 2;
    const h = t.height + paddingY * 2;

    t.setPosition(w - paddingX, paddingY);

    bg.fillStyle(0xffffff, 1);
    bg.lineStyle(2, 0x111111, 0.9);

    const r = 16;
    bg.fillRoundedRect(0, 0, w, h, r);
    bg.strokeRoundedRect(0, 0, w, h, r);

    const tailMidY = h * 0.6;
    bg.fillTriangle(0, tailMidY - 10, 0, tailMidY + 10, -18, tailMidY);
    bg.lineBetween(0, tailMidY - 10, -18, tailMidY);
    bg.lineBetween(0, tailMidY + 10, -18, tailMidY);

    const container = this.scene.add.container(bubbleX, bubbleY, [bg, t]).setDepth(depth);
    container.setAlpha(0);
    container.setScale(0.96);

    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Sine.easeOut",
    });

    this.speech = container;
  }

  private hideSpeechBubbleOnly() {
    this.speech?.destroy(true);
    this.speech = undefined;
  }

  private hideNoam() {
    this.hideSpeechBubbleOnly();
    this.noam?.destroy();
    this.noam = undefined;
  }

  // ---------- TASK UI ----------

  private startVendorsTask(playerIndex: number, done: () => void) {
    this.pendingDone = done; // ✅ הכי חשוב: כדי שהצלחה תמשיך

    this.destroyTaskUI();
    this.found.clear();
    this.currentInput = "";
    this.remaining = 60;

    this.scene.input.topOnly = true;

    const depth = 25000;

    const root = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height / 2);
    root.setDepth(depth);
    root.setScrollFactor(0);
    this.uiRoot = root;

    const overlay = this.scene.add
      .rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.55)
      .setOrigin(0.5)
      .setScrollFactor(0);
    overlay.disableInteractive();

    const panelW = Math.min(820, Math.floor(this.scene.scale.width * 0.88));
    const panelH = 420;

    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0xffffff, 1);
    panelBg.lineStyle(3, 0x111111, 0.9);
    panelBg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 22);
    panelBg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 22);

    const title = this.scene.add
      .text(-panelW / 2 + 24, -panelH / 2 + 18, "כתבי 10 ספקים / שירותים שצריך לסגור לפני החתונה תוך דקה !", {
        fontFamily: "Arial Black",
        fontSize: "20px",
        color: "#111",
      })
      .setOrigin(0, 0);

    const timer = this.scene.add
      .text(panelW / 2 - 24, -panelH / 2 + 18, "⏳ 01:00", {
        fontFamily: "Arial Black",
        fontSize: "20px",
        color: "#d90429",
      })
      .setOrigin(1, 0);
    this.timerText = timer;

    const hint = this.scene.add
      .text(-panelW / 2 + 24, -panelH / 2 + 56, "טיפ: כתבי ספק אחד ולחצי אנטר. אפשר גם כמה יחד עם פסיקים.", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#333",
      })
      .setOrigin(0, 0);

    const inputBg = this.scene.add.graphics();
    inputBg.fillStyle(0xf3f3f3, 1);
    inputBg.lineStyle(2, 0x111111, 0.35);
    inputBg.fillRoundedRect(-panelW / 2 + 24, -40, panelW - 48, 58, 14);
    inputBg.strokeRoundedRect(-panelW / 2 + 24, -40, panelW - 48, 58, 14);

    const inputLabel = this.scene.add
      .text(-panelW / 2 + 40, -26, "הקלידי כאן:", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#555",
      })
      .setOrigin(0, 0);

    const inputText = this.scene.add
      .text(-panelW / 2 + 40, -6, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
      })
      .setOrigin(0, 0);
    this.inputText = inputText;

    const listTitle = this.scene.add
      .text(-panelW / 2 + 24, 40, "נכנסו (0/10):", {
        fontFamily: "Arial Black",
        fontSize: "16px",
        color: "#111",
      })
      .setOrigin(0, 0);

    const listText = this.scene.add
      .text(-panelW / 2 + 24, 70, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
        wordWrap: { width: panelW - 48, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    this.listText = listText;

    root.add([overlay, panelBg, title, timer, hint, inputBg, inputLabel, inputText, listTitle, listText]);

    const kb = this.scene.input.keyboard;
    if (!kb) return;

    kb.removeAllListeners("keydown");
    kb.on("keydown", (ev: KeyboardEvent) => {
      if (!this.uiRoot) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      if (ev.key === "Enter") {
        this.submitCurrentLine();
        return;
      }

      if (ev.key === "Backspace") {
        this.currentInput = this.currentInput.slice(0, -1);
        this.renderInput();
        return;
      }

      if (ev.key.length === 1) {
        this.currentInput += ev.key;
        this.renderInput();
      }
    });

    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.remaining -= 1;
        this.renderTimer();
        if (this.remaining <= 0) this.fail(playerIndex);
      },
    });

    this.renderTimer();
    this.renderList();
  }

  private submitCurrentLine() {
    const raw = this.currentInput.trim();
    this.currentInput = "";
    this.renderInput();
    if (!raw) return;

    const parts = raw
      .split(/[,\n]+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const p of parts) {
      const canon = this.toCanonical(p);
      if (!canon) continue;
      this.found.add(canon);

      if (this.found.size >= 10) {
        this.win();
        return;
      }
    }

    this.renderList();
  }

  private toCanonical(input: string): string | null {
    const s0 = input.trim().toLowerCase();

    const s1 = s0
      .replace(/[״"]/g, "'")
      .replace(/[–—-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const dj = s1.replace(/\s/g, "");
    if (dj === "dj" || dj === "d-j" || dj === "d_j") return "dj";

    const map: Record<string, string> = {
      "די ג'יי": "די ג'יי",
      "די גיי": "די ג'יי",
      "דיג'יי": "די ג'יי",
      "דיגיי": "די ג'יי",
      "מוזקאי": "מוזיקאי",
      "בר שתיה": "בר שתייה",
      "בר שתייה": "בר שתייה",
      "לק ג׳ל": "לק ג'ל",
      "לק ג'ל": "לק ג'ל",
      "צלמת מגנטים": "צלמת מגנטים",
      "צלם מגנטים": "צלם מגנטים",
    };

    const candidate = map[s1] ?? input.trim();
    const cleaned = candidate.replace(/\s+/g, " ").replace(/^\u200f+|\u200f+$/g, "").trim();

    if (this.allowedCanon.has(cleaned)) return cleaned;
    return null;
  }

  private renderTimer() {
    if (!this.timerText) return;
    const m = Math.floor(this.remaining / 60);
    const s = this.remaining % 60;
    this.timerText.setText(`⏳ ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
  }

  private renderInput() {
    this.inputText?.setText(this.currentInput);
  }

  private renderList() {
    if (!this.listText || !this.uiRoot) return;

    const arr = Array.from(this.found.values());
    this.listText.setText(arr.join(" , "));

    const titleObj = this.uiRoot.list.find(
      (o) => (o as Phaser.GameObjects.Text).text?.startsWith("נכנסו")
    ) as Phaser.GameObjects.Text | undefined;

    if (titleObj && "setText" in titleObj) {
      titleObj.setText(`נכנסו (${this.found.size}/10):`);
    }
  }

  // ✅ הצלחה עם הודעה ואז ממשיכים
  private win() {
    this.stopTimer();
    this.destroyTaskUI();
    this.hideNoam();

    this.showSuccessToast("אלופה!! סגרת את כל הספקים לחתונה", () => {
      this.unlockInternal();
      this.scene.input.topOnly = false;

      const done = this.pendingDone;
      this.pendingDone = undefined;
      done?.();
    });
  }

  // ✅ כישלון: penalty ואז ממשיכים (עם failsafe נגד תקיעה)
  private fail(playerIndex: number) {
    this.stopTimer();
    this.destroyTaskUI();
    this.hideNoam();

    let finished = false;

    // failsafe: אם השרת לא מחזיר penaltyMove, שלא ניתקע
    const guard = this.scene.time.delayedCall(3000, () => {
      if (finished) return;
      finished = true;

      this.unlockInternal();
      this.scene.input.topOnly = false;

      const done = this.pendingDone;
      this.pendingDone = undefined;
      done?.();
    });

    this.opts.onFailPenalty(playerIndex, -5, () => {
      if (finished) return;
      finished = true;
      guard.remove(false);

      this.unlockInternal();
      this.scene.input.topOnly = false;

      const done = this.pendingDone;
      this.pendingDone = undefined;
      done?.();
    });
  }

  private showSuccessToast(text: string, onDone: () => void) {
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
        this.scene.time.delayedCall(1400, () => {
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

  // ---------- lock flow ----------

  private lockInternal() {
    this.locked = true;
    this.opts.lock();
  }

  private unlockInternal() {
    this.locked = false;
    this.opts.unlock();
  }

  private stopTimer() {
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = undefined;
    }
  }

  private destroyTaskUI() {
    this.stopTimer();
    this.uiRoot?.destroy(true);
    this.uiRoot = undefined;
    this.timerText = undefined;
    this.inputText = undefined;
    this.listText = undefined;
    this.scene.input.keyboard?.removeAllListeners("keydown");
  }
}