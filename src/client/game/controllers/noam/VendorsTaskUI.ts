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

  private remaining = 60;
  private timerEvent?: Phaser.Time.TimerEvent;

  private currentInput = "";
  private found = new Set<string>();

  private keydownHandler?: (ev: KeyboardEvent) => void;
  private resolve?: (r: VendorsTaskUIResult) => void;
  private finished = false;

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
    const panelH = 420;

    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0xffffff, 1);
    panelBg.lineStyle(3, 0x111111, 0.9);
    panelBg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 22);
    panelBg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 22);

    const title = this.scene.add
      .text(-panelW / 2 + 24, -panelH / 2 + 18, `כתבי ${needCount} ספקים / שירותים שצריך לסגור לפני החתונה תוך דקה !`, {
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
    if (!kb) {
      // בלי מקלדת → לא נתקעים
      this.finish({ ok: false, found: [] });
      return Promise.resolve({ ok: false, found: [] });
    }

    this.keydownHandler = (ev: KeyboardEvent) => {
      if (!this.uiRoot || this.finished) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      if (ev.key === "Enter") {
        this.submitLine(needCount);
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
    };

    kb.on("keydown", this.keydownHandler);

    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.remaining -= 1;
        this.renderTimer();
        if (this.remaining <= 0) this.finish({ ok: false, found: Array.from(this.found) });
      },
    });

    this.renderTimer();
    this.renderList(needCount);

    return new Promise<VendorsTaskUIResult>((resolve) => {
      this.resolve = resolve;
    });
  }

  cleanup() {
    this.stopTimer();
    const kb = this.scene.input.keyboard;
    if (kb && this.keydownHandler) kb.off("keydown", this.keydownHandler);
    this.keydownHandler = undefined;

    this.uiRoot?.destroy(true);
    this.uiRoot = undefined;
    this.timerText = undefined;
    this.inputText = undefined;
    this.listText = undefined;

    this.resolve = undefined;
    this.scene.input.topOnly = false;
    this.finished = false;
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

    let anyAccepted = false;

    for (const p of parts) {
      const canon = this.canon.toCanonical(p);
      if (!canon) continue;
      anyAccepted = true;
      this.found.add(canon);

      if (this.found.size >= needCount) {
        this.finish({ ok: true, found: Array.from(this.found) });
        return;
      }
    }

    if (!anyAccepted) {
      // כאן אפשר בעתיד להחזיר גם reason/UI feedback,
      // אבל כרגע זה רק “לא נקלט” בלי לתקוע.
    }

    this.renderList(needCount);
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
}