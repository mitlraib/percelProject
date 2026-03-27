// src/client/game/controllers/noam/VendorsTaskUI.ts
import Phaser from "phaser";
import VendorsCanon from "./VendorsCanon";

export type VendorsTaskUIResult =
  | { ok: true; found: string[] }
  | { ok: false; found: string[] };

export default class VendorsTaskUI {
  private scene: Phaser.Scene;
  private canon: VendorsCanon;

  private uiRoot?: Phaser.GameObjects.Container;
  private timerText?: Phaser.GameObjects.Text;
  private inputText?: Phaser.GameObjects.Text;
  private listText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private feedbackTimer?: Phaser.Time.TimerEvent;

  private remaining = 60;
  private timerEvent?: Phaser.Time.TimerEvent;

  private currentInput = "";
  private found = new Set<string>();

  private resolve?: (r: VendorsTaskUIResult) => void;
  private finished = false;

  private htmlInput?: HTMLInputElement;

  constructor(scene: Phaser.Scene, canon: VendorsCanon) {
    this.scene = scene;
    this.canon = canon;
  }

  run(params: { seconds: number; needCount: number }): Promise<VendorsTaskUIResult> {
    const { seconds, needCount } = params;

    this.cleanup();
    this.finished = false;
    this.remaining = seconds;
    this.currentInput = "";
    this.found.clear();

    this.scene.input.topOnly = true;

    const depth = 25000;
    const root = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height / 2);
    root.setDepth(depth).setScrollFactor(0);
    this.uiRoot = root;

    const overlay = this.scene.add
      .rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.55)
      .setOrigin(0.5)
      .setScrollFactor(0);
    overlay.disableInteractive();

    const panelW = Math.min(820, Math.floor(this.scene.scale.width * 0.88));
    // גובה הפאנל מותאם למסכים קטנים כדי שלא יחתך בנייד
    const panelH = Math.min(420, Math.floor(this.scene.scale.height * 0.9));

    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0xffffff, 1);
    panelBg.lineStyle(3, 0x111111, 0.9);
    panelBg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 22);
    panelBg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 22);

    const title = this.scene.add
      .text(
        panelW / 2 - 24,
        -panelH / 2 + 58,
        // סימן הקריאה בתחילת המחרוזת כך שב-RTL הוא יוצג בסוף המשפט (בשמאל)
        `! כתבי ${needCount} ספקים / שירותים שצריך לסגור לפני החתונה תוך דקה`,
        {
          fontFamily: "Arial Black",
          fontSize: "20px",
          color: "#111",
          align: "right",
          wordWrap: { width: panelW - 140, useAdvancedWrap: true },
        }
      )
      .setOrigin(1, 0);

    const timer = this.scene.add
      .text(panelW / 2 - 24, -panelH / 2 + 18, "⏳ 01:00", {
        fontFamily: "Arial Black",
        fontSize: "20px",
        color: "#d90429",
      })
      .setOrigin(1, 0);
    this.timerText = timer;

    const hint = this.scene.add
      .text(
        panelW / 2 - 24,
        -panelH / 2 + 132,
        // הטיפ קודם, אחריו ההסבר – סדר ברור בעברית
        "טיפ\u200F: כתבי ספק אחד ולחצי Enter. אחר כך אפשר להזין עוד ספקים מופרדים בפסיקים.",
        {
          fontFamily: "Arial",
          fontSize: "16px",
          color: "#333",
          align: "right",
          wordWrap: { width: panelW - 48, useAdvancedWrap: true },
        }
      )
      .setOrigin(1, 0);

    const inputBg = this.scene.add.graphics();
    inputBg.fillStyle(0xf3f3f3, 1);
    inputBg.lineStyle(2, 0x111111, 0.35);
    inputBg.fillRoundedRect(-panelW / 2 + 24, -10, panelW - 48, 58, 14);
    inputBg.strokeRoundedRect(-panelW / 2 + 24, -10, panelW - 48, 58, 14);

    const inputLabel = this.scene.add
      .text(panelW / 2 - 40, 4, "הקלידי כאן:", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#555",
        align: "right",
      })
      .setOrigin(1, 0);

    const inputText = this.scene.add
      .text(panelW / 2 - 40, 24, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
        align: "right",
        wordWrap: { width: panelW - 90, useAdvancedWrap: true },
      })
      .setOrigin(1, 0);
    this.inputText = inputText;

    const listTitle = this.scene.add
      .text(panelW / 2 - 24, 80, `נכנסו (0/${needCount}):`, {
        fontFamily: "Arial Black",
        fontSize: "16px",
        color: "#111",
        align: "right",
      })
      .setOrigin(1, 0);

    const listText = this.scene.add
      .text(panelW / 2 - 24, 110, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
        align: "right",
        wordWrap: { width: panelW - 48, useAdvancedWrap: true },
      })
      .setOrigin(1, 0);
    this.listText = listText;

    root.add([overlay, panelBg, title, timer, hint, inputBg, inputLabel, inputText, listTitle, listText]);

    this.createMobileInput(needCount);

    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.remaining -= 1;
        this.renderTimer();

        if (this.remaining <= 0) {
          this.finish({ ok: false, found: Array.from(this.found) });
        }
      },
    });

    this.renderTimer();
    this.renderInput();
    this.renderList(needCount);

    return new Promise<VendorsTaskUIResult>((resolve) => {
      this.resolve = resolve;
    });
  }

  cleanup() {
    this.stopTimer();
    this.destroyHtmlInput();

    this.uiRoot?.destroy(true);
    this.uiRoot = undefined;
    this.timerText = undefined;
    this.inputText = undefined;
    this.listText = undefined;
    this.feedbackText = undefined;
    this.feedbackTimer?.remove(false);
    this.feedbackTimer = undefined;

    this.resolve = undefined;
    this.scene.input.topOnly = false;
    this.finished = false;
  }

  private createMobileInput(needCount: number) {
    this.destroyHtmlInput();

    const device = this.scene.sys.game.device;
    const isMobile = device.os.android || device.os.iOS;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "כתבי ספק...";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.dir = "rtl";

    const viewport = (window as any).visualViewport || window;
    const vw = viewport.width;
    const vh = viewport.height;

    // במובייל: תיבת הטקסט קצת מעל האמצע כדי שתהיה מעל המקלדת.
    // בדסקטופ: נמוך אבל מעט יותר גבוה (52%) כדי שלא יסתיר את הרשימה.
    const inputCenterY = isMobile ? Math.round(vh * 0.36) : Math.round(vh * 0.52);
    input.style.position = "fixed";
    input.style.left = `${vw / 2}px`;
    input.style.top = `${inputCenterY}px`;
    input.style.transform = "translate(-50%, -50%)";
    input.style.width = `min(94vw, ${Math.min(720, vw - 48)}px)`;
    input.style.height = "56px";
    input.style.padding = "0 20px";
    input.style.fontSize = "22px";
    input.style.borderRadius = "12px";
    input.style.border = "2px solid #111";
    input.style.zIndex = "999999";
    input.style.background = "#ffffff";
    input.style.color = "#111111";

    // במסך מלא רק ילדים של fullscreenElement מוצגים, לכן מוסיפים לשם אם קיים.
    const fullscreenHost = document.fullscreenElement as HTMLElement | null;
    const host = fullscreenHost ?? document.body;
    host.appendChild(input);
    this.htmlInput = input;

    input.addEventListener("input", () => {
      this.currentInput = input.value;
      this.renderInput();
    });

    input.addEventListener("keydown", (ev) => {
      // חשוב: לא להעביר את האירוע לפייזר, כדי ש-Space וכולי יעבדו כרגיל בשדה הטקסט
      ev.stopPropagation();

      if (ev.key === "Enter") {
        ev.preventDefault();
        this.submitLine(needCount);
        input.value = "";
        this.currentInput = "";
        this.renderInput();

        window.setTimeout(() => {
          input.focus();
        }, 0);
      }
    });

    // חשוב: לפתוח מקלדת בנייד
    window.setTimeout(() => {
      input.focus();
    }, 50);
  }

  private destroyHtmlInput() {
    if (this.htmlInput) {
      this.htmlInput.remove();
      this.htmlInput = undefined;
    }
  }

  private submitLine(needCount: number) {
    const raw = this.currentInput.trim();
    this.currentInput = "";
    this.renderInput();

    if (!raw) return;

    const parts = raw
      .split(/[,\n]+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    let hasInvalid = false;
    for (const p of parts) {
      const canon = this.canon.toCanonical(p);
      if (!canon) {
        hasInvalid = true;
        continue;
      }

      this.found.add(canon);

      if (this.found.size >= needCount) {
        this.finish({ ok: true, found: Array.from(this.found) });
        return;
      }
    }

    this.renderList(needCount);
    if (hasInvalid) {
      this.showFeedback("זה לא ברשימה שלי");
    }
  }

  private finish(result: VendorsTaskUIResult) {
    if (this.finished) return;
    this.finished = true;

    const resolveNow = this.resolve;
    this.cleanup();
    resolveNow?.(result);
  }

  private stopTimer() {
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = undefined;
    }
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

  private renderList(needCount: number) {
    if (!this.listText || !this.uiRoot) return;

    const arr = Array.from(this.found.values());
    this.listText.setText(arr.join(" , "));

    const titleObj = this.uiRoot.list.find(
      (o) => (o as Phaser.GameObjects.Text).text?.startsWith("נכנסו")
    ) as Phaser.GameObjects.Text | undefined;

    if (titleObj && "setText" in titleObj) {
      titleObj.setText(`נכנסו (${this.found.size}/${needCount}):`);
    }
  }

  private showFeedback(message: string) {
    if (!this.feedbackText) {
      this.feedbackText = this.scene.add
        .text(0, 146, "", {
          fontFamily: "Arial Black",
          fontSize: "18px",
          color: "#b00020",
          align: "center",
        })
        .setOrigin(0.5, 0);
      this.uiRoot?.add(this.feedbackText);
    }

    this.feedbackText.setText(message);
    this.feedbackTimer?.remove(false);
    this.feedbackTimer = this.scene.time.delayedCall(1200, () => {
      this.feedbackText?.setText("");
    });
  }
}