// src/client/game/ui/WeddingVendorsTask.ts
import Phaser from "phaser";

export type WeddingVendorsTaskOpts = {
  depth?: number;
  seconds?: number; // ברירת מחדל: 60
  requiredCount?: number; // ברירת מחדל: 10
  onComplete?: (success: boolean) => void;
};

export default class WeddingVendorsTask {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;

  private onComplete?: (success: boolean) => void;

  private readonly seconds: number;
  private readonly requiredCount: number;

  private timeLeftMs: number;
  private timer?: Phaser.Time.TimerEvent;

  private titleText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private inputText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private listText!: Phaser.GameObjects.Text;

  private input = "";
  private accepted = new Set<string>(); // normalized keys
  private acceptedDisplay: string[] = [];

  private keyHandler?: (ev: KeyboardEvent) => void;

  private vendorKeys: string[];

  constructor(scene: Phaser.Scene, opts: WeddingVendorsTaskOpts = {}) {
    this.scene = scene;
    this.onComplete = opts.onComplete;

    this.seconds = opts.seconds ?? 60;
    this.requiredCount = opts.requiredCount ?? 10;
    this.timeLeftMs = this.seconds * 1000;

    this.vendorKeys = this.buildVendorKeys();

    // כדי שלא יתפס משהו מאחור
    this.scene.input.topOnly = true;

    const depth = opts.depth ?? 26000;
    this.root = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);
    this.root.setScrollFactor(0);
    this.root.setDepth(depth);

    this.build();
    this.startTimer();
    this.attachKeyboard();
  }

  destroy() {
    this.detachKeyboard();

    if (this.timer) {
      this.timer.remove(false);
      this.timer = undefined;
    }

    this.root.destroy(true);

    // להחזיר topOnly למצב רגיל
    this.scene.input.topOnly = false;
  }

  // ---------------- UI ----------------

  private build() {
    const { width, height } = this.scene.scale;

    const panelW = Math.min(720, width - 80);
    const panelH = Math.min(420, height - 90);

    // overlay
    const overlay = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.6)
      .setOrigin(0.5)
      .setScrollFactor(0);
    overlay.disableInteractive();

    // panel bg
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.lineStyle(3, 0x111111, 0.9);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 20);

    this.titleText = this.scene.add
      .text(-panelW / 2 + 24, -panelH / 2 + 20, "כתבי 10 ספקים / שירותים שצריך לסגור לפני החתונה תוך דקה!", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
      })
      .setOrigin(0, 0);

    this.timerText = this.scene.add
      .text(panelW / 2 - 24, -panelH / 2 + 18, this.formatTime(this.timeLeftMs), {
        fontFamily: "Arial Black",
        fontSize: "20px",
        color: "#d11",
      })
      .setOrigin(1, 0);

    const line = this.scene.add.graphics();
    line.lineStyle(2, 0x111111, 0.15);
    line.lineBetween(-panelW / 2 + 20, -panelH / 2 + 62, panelW / 2 - 20, -panelH / 2 + 62);

    this.hintText = this.scene.add
      .text(-panelW / 2 + 24, -panelH / 2 + 78, "הקלידי ספק אחד ואז לחצי Enter. אפשר גם לשים פסיקים, נפרק לבד.", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#444",
      })
      .setOrigin(0, 0);

    // input box
    const inputBox = this.scene.add.graphics();
    inputBox.fillStyle(0xf6f6f6, 1);
    inputBox.lineStyle(2, 0x111111, 0.35);
    inputBox.fillRoundedRect(-panelW / 2 + 24, -panelH / 2 + 115, panelW - 48, 52, 14);
    inputBox.strokeRoundedRect(-panelW / 2 + 24, -panelH / 2 + 115, panelW - 48, 52, 14);

    this.inputText = this.scene.add
      .text(-panelW / 2 + 38, -panelH / 2 + 128, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
      })
      .setOrigin(0, 0);

    const counter = this.scene.add
      .text(panelW / 2 - 30, -panelH / 2 + 128, `0/${this.requiredCount}`, {
        fontFamily: "Arial Black",
        fontSize: "18px",
        color: "#111",
      })
      .setOrigin(1, 0);

    // list area
    const listBox = this.scene.add.graphics();
    listBox.fillStyle(0xffffff, 1);
    listBox.lineStyle(2, 0x111111, 0.15);
    listBox.fillRoundedRect(-panelW / 2 + 24, -panelH / 2 + 185, panelW - 48, panelH - 215, 14);
    listBox.strokeRoundedRect(-panelW / 2 + 24, -panelH / 2 + 185, panelW - 48, panelH - 215, 14);

    this.listText = this.scene.add
      .text(-panelW / 2 + 38, -panelH / 2 + 200, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#111",
        wordWrap: { width: panelW - 76, useAdvancedWrap: true },
        align: "right",
      })
      .setOrigin(0, 0);

    // blink caret (פשוט)
    const caret = this.scene.add
      .text(-panelW / 2 + 38, -panelH / 2 + 128, "│", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
      })
      .setOrigin(0, 0);

    this.scene.tweens.add({
      targets: caret,
      alpha: 0,
      duration: 450,
      yoyo: true,
      repeat: -1,
    });

    const updateCounter = () => {
      counter.setText(`${this.accepted.size}/${this.requiredCount}`);
    };

    // hook: update counter when list changes
    const oldRender = this.render.bind(this);
    this.render = () => {
      oldRender();
      updateCounter();
      caret.setX(this.inputText.x + this.inputText.width + 2);
    };

    this.root.add([overlay, bg, this.titleText, this.timerText, line, this.hintText, inputBox, this.inputText, caret, counter, listBox, this.listText]);

    this.render();
  }

  private render() {
    const safe = this.input.length ? this.input : "";
    this.inputText.setText(safe);

    const lines =
      this.acceptedDisplay.length === 0
        ? "עוד לא הוספת ספקים."
        : this.acceptedDisplay.map((v, i) => `${i + 1}. ${v}`).join("\n");

    this.listText.setText(lines);
  }

  // ---------------- timer ----------------

  private startTimer() {
    this.timer = this.scene.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        this.timeLeftMs -= 200;
        if (this.timeLeftMs < 0) this.timeLeftMs = 0;

        this.timerText.setText(this.formatTime(this.timeLeftMs));

        if (this.timeLeftMs === 0) {
          this.finish(false);
        }
      },
    });
  }

  private formatTime(ms: number) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `⏳ ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // ---------------- keyboard input ----------------

  private attachKeyboard() {
    this.keyHandler = (ev: KeyboardEvent) => {
      // לא להתערב בקיצורי מערכת
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      const key = ev.key;

      if (key === "Enter") {
        ev.preventDefault();
        this.submitCurrent();
        return;
      }

      if (key === "Backspace") {
        ev.preventDefault();
        this.input = this.input.slice(0, -1);
        this.render();
        return;
      }

      if (key === "Escape") {
        // אין יציאה, לא עושים כלום
        ev.preventDefault();
        return;
      }

      // תווים רגילים
      if (key.length === 1) {
        // הגבלה קטנה כדי לא להשתגע
        if (this.input.length >= 42) return;
        this.input += key;
        this.render();
      }
    };

    window.addEventListener("keydown", this.keyHandler);
  }

  private detachKeyboard() {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = undefined;
    }
  }

  private submitCurrent() {
    const raw = this.input.trim();
    if (!raw) return;

    // תומך גם בפסיקים / מפריד לשורות
    const parts = raw
      .split(/[,\n]+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    parts.forEach((p) => this.tryAcceptVendor(p));

    this.input = "";
    this.render();

    if (this.accepted.size >= this.requiredCount) {
      this.finish(true);
    }
  }

  private tryAcceptVendor(userText: string) {
    const norm = this.normalize(userText);
    if (!norm) return;

    // אם המשתמש כתב משהו ארוך, נבדוק גם "מכיל"
    const isOk = this.vendorKeys.some((k) => norm === k || norm.includes(k) || k.includes(norm));
    if (!isOk) return;

    // מפתח ייחודי לסט
    const bestKey = this.vendorKeys.find((k) => norm === k) ?? this.vendorKeys.find((k) => norm.includes(k)) ?? norm;

    if (this.accepted.has(bestKey)) return;
    this.accepted.add(bestKey);

    // לשמירה לתצוגה נשאיר את הטקסט כמו שהמשתמש כתב (נחמד)
    this.acceptedDisplay.push(userText.trim());
  }

  // ---------------- vendors ----------------

  private normalize(s: string) {
    return s
      .toLowerCase()
      .replace(/[’'"]/g, "")
      .replace(/[‐-–—]/g, "-")
      .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private buildVendorKeys() {
    // הרשימה שנתת, כולל וריאציות
    const raw = [
      "צלם",
      "מאפרת",
      "איפור",
      "תסרוקת",
      "תסרוקאית",
      "מעצבת שיער",
      "לק",
      "לק ג'ל",
      "לק ג׳ל",
      "מניקור",
      "פדיקור",
      "מניקוריסטית",
      "מנהל אירוע",
      "די ג'יי",
      "די ג׳יי",
      "dj",
      "d-j",
      "d j",
      "מוזקאי",
      "מוזיקאי",
      "זמר",
      "להקה",
      "רב",
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
      "בר שתיה",
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
    ];

    // normalize + dedupe
    const set = new Set<string>();
    raw.forEach((r) => set.add(this.normalize(r)));

    // חיזוקים קטנים כדי לתפוס כתיבות נפוצות
    set.add(this.normalize("dj"));
    set.add(this.normalize("דיג'יי"));
    set.add(this.normalize("דיג׳יי"));
    set.add(this.normalize("די גיי"));
    set.add(this.normalize("די-גיי"));

    return Array.from(set).filter(Boolean);
  }

  // ---------------- finish ----------------

  private finish(success: boolean) {
    // למנוע כפילות
    if (this.timer) {
      this.timer.remove(false);
      this.timer = undefined;
    }

    // הודעת סיום
    const msg = this.scene.add
      .text(0, this.listText.y + this.listText.height + 18, success ? "אלופה! סגרת ספקים 🎉" : "אוי לא… לא הספקת בזמן 😬", {
        fontFamily: "Arial Black",
        fontSize: "20px",
        color: "#111",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.root.add(msg);

    this.scene.time.delayedCall(450, () => {
      this.onComplete?.(success);
      this.destroy();
    });
  }
}