import Phaser from "phaser";

type CleanupPuzzleOpts = {
  depth?: number;
  onComplete?: () => void;
};

type Slot = {
  id: number;
  x: number;
  y: number;
  occupied: boolean;
  container: Phaser.GameObjects.Container;
};

export default class CleanupPuzzle {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;

  private readonly grid = 3;
  private readonly slotSize = 84;
  private readonly slotGap = 14;

  private readonly tileSize = 72;

  private onComplete?: () => void;

  private items: { label: string; shadow: string }[] = [
    { label: "🧻 נייר", shadow: "🧻" },
    { label: "🧹 מטאטא", shadow: "🧹" },
    { label: "🪟 חלון", shadow: "🪟" },
    { label: "🧺 כביסה", shadow: "🧺" },
    { label: "🗑️ פח", shadow: "🗑️" },
    { label: "🧼 סבון", shadow: "🧼" },
    { label: "🪣 דלי", shadow: "🪣" },
    { label: "🧴 ספריי", shadow: "🧴" },
    { label: "🧽 ספוג", shadow: "🧽" },
  ];

  private slots: Slot[] = [];
  private tiles: Phaser.GameObjects.Container[] = [];
  private homePos = new Map<number, { x: number; y: number }>();
  private placedCount = 0;

  constructor(scene: Phaser.Scene, opts: CleanupPuzzleOpts = {}) {
    this.scene = scene;
    this.onComplete = opts.onComplete;

    // ✅ כדי שלא “יתפס” משהו מאחור
    this.scene.input.topOnly = true;

    const depth = opts.depth ?? 25000;

    // root UI container
    this.root = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);
    this.root.setDepth(depth);
    this.root.setScrollFactor(0);

    this.build();
  }

  private build() {
    const gridW = this.grid * this.slotSize + (this.grid - 1) * this.slotGap;
    const gridH = gridW;

    const panelPadX = 34;
    const panelTopPad = 84;
    const panelBottomPad = 70;

    const panelLeft = -gridW / 2 - panelPadX;
    const panelTop = -gridH / 2 - panelTopPad;
    const panelW = gridW + panelPadX * 2;
    const panelH = gridH + panelBottomPad + panelTopPad;

    // ✅ overlay כהה (לא אינטראקטיבי)
    const overlay = this.scene.add
      .rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.55)
      .setOrigin(0.5)
      .setScrollFactor(0);
    overlay.disableInteractive();

    // ✅ פאנל
    const panelBg = this.scene.add.graphics().setScrollFactor(0);
    panelBg.fillStyle(0xffffff, 1);
    panelBg.lineStyle(3, 0x111111, 0.9);
    panelBg.fillRoundedRect(panelLeft, panelTop, panelW, panelH, 20);
    panelBg.strokeRoundedRect(panelLeft, panelTop, panelW, panelH, 20);

    const title = this.scene.add
      .text(panelLeft + 24, panelTop + 24, "סדרי את הבית – גררי כל פריט למקום הנכון", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#111",
      })
      .setOrigin(0, 0)
      .setScrollFactor(0);

    // ❌ אין X
    this.root.add([overlay, panelBg, title]);

    // ✅ slots (בפנים) — לא אינטראקטיביים
    this.slots = [];
    for (let cell = 0; cell < 9; cell++) {
      const id = cell;
      const { x, y } = this.cellToXY(cell, this.slotSize, this.slotGap);
      const slot = this.createSlot(id, x, y);
      slot.container.setScrollFactor(0);
      slot.container.disableInteractive();
      this.slots.push(slot);
      this.root.add(slot.container);
    }

    // --- tiles בחוץ (בצדדים: שמאל + ימין) ---
    const ids = [...Array(9)].map((_, i) => i);
    this.shuffle(ids);

    this.tiles = [];
    this.homePos.clear();
    this.placedCount = 0;

    const leftIds = ids.slice(0, 5);
    const rightIds = ids.slice(5);

    const sideGap = 26;
    const colXLeft = -gridW / 2 - sideGap - this.tileSize / 2;
    const colXRight = gridW / 2 + sideGap + this.tileSize / 2;

    const startY = -gridH / 2 + this.tileSize / 2;
    const endY = gridH / 2 - this.tileSize / 2;

    const layoutColumn = (arr: number[], x: number) => {
      const n = arr.length;
      const step = n <= 1 ? 0 : (endY - startY) / (n - 1);

      arr.forEach((tileId, i) => {
        const y = startY + i * step;

        const tile = this.createTile(tileId);
        tile.x = x;
        tile.y = y;
        tile.setScrollFactor(0);

        this.tiles.push(tile);
        this.homePos.set(tileId, { x, y });
        this.root.add(tile);
      });
    };

    layoutColumn(leftIds, colXLeft);
    layoutColumn(rightIds, colXRight);

    this.root.bringToTop(title);

    // ✅ אם את רוצה לבדוק האם בכלל מגיע קליק לפאזל:
    // this.scene.input.on("gameobjectdown", (_p, go) => console.log("down:", go.name));
  }

  private createSlot(id: number, x: number, y: number): Slot {
    const c = this.scene.add.container(x, y).setScrollFactor(0);

    const bg = this.scene.add.graphics().setScrollFactor(0);
    bg.fillStyle(0xffffff, 1);
    bg.lineStyle(3, 0x111111, 0.35);
    bg.fillRoundedRect(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize, 14);
    bg.strokeRoundedRect(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize, 14);

    const shadowIcon = this.scene.add
      .text(0, -6, this.items[id].shadow, { fontFamily: "Arial", fontSize: "26px", color: "#111" })
      .setOrigin(0.5)
      .setAlpha(0.18)
      .setScrollFactor(0);

    const shadowLabel = this.scene.add
      .text(0, 22, this.items[id].label.replace(/^[^\s]+\s/, ""), {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#111",
      })
      .setOrigin(0.5)
      .setAlpha(0.14)
      .setScrollFactor(0);

    c.add([bg, shadowIcon, shadowLabel]);
    return { id, x, y, occupied: false, container: c };
  }

  // ✅ Drag יציב: ה-Zone הוא האינטראקטיבי, והוא מזיז את ה-Container
  private createTile(tileId: number) {
    const c = this.scene.add.container(0, 0).setScrollFactor(0);
    c.name = `tile-${tileId}`;

    const bg = this.scene.add.graphics().setScrollFactor(0);
    bg.fillStyle(0xf6f6f6, 1);
    bg.lineStyle(3, 0x111111, 0.85);
    bg.fillRoundedRect(-this.tileSize / 2, -this.tileSize / 2, this.tileSize, this.tileSize, 14);
    bg.strokeRoundedRect(-this.tileSize / 2, -this.tileSize / 2, this.tileSize, this.tileSize, 14);

    const label = this.items[tileId].label;
    const t = this.scene.add
      .text(0, 0, label, { fontFamily: "Arial", fontSize: "17px", color: "#111", align: "center" })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const hitZone = this.scene.add.zone(0, 0, this.tileSize, this.tileSize).setOrigin(0.5);
    hitZone.name = `hit-${tileId}`;
    hitZone.setScrollFactor(0);
    hitZone.setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(hitZone);

    c.add([bg, t, hitZone]);
    (c as any).__tileId = tileId;

    hitZone.on("pointerdown", () => {
      c.setDepth(999999);
      this.root.bringToTop(c);
    });

    hitZone.on("dragstart", (pointer: Phaser.Input.Pointer) => {
      this.scene.tweens.killTweensOf(c);

      // ✅ offset שלא יקפוץ
      const tileScreenX = this.root.x + c.x;
      const tileScreenY = this.root.y + c.y;
      (c as any).__dragOffX = pointer.x - tileScreenX;
      (c as any).__dragOffY = pointer.y - tileScreenY;

      this.scene.tweens.add({ targets: c, scale: 1.06, duration: 80, ease: "Sine.easeOut" });
    });

    hitZone.on("drag", (pointer: Phaser.Input.Pointer) => {
      const offX = (c as any).__dragOffX ?? 0;
      const offY = (c as any).__dragOffY ?? 0;

      // ✅ קואורדינטות מסך (כי זה UI)
      const px = Phaser.Math.Clamp(pointer.x, 0, this.scene.scale.width);
      const py = Phaser.Math.Clamp(pointer.y, 0, this.scene.scale.height);

      c.x = px - this.root.x - offX;
      c.y = py - this.root.y - offY;
    });

    hitZone.on("dragend", () => {
      this.scene.tweens.add({ targets: c, scale: 1, duration: 80, ease: "Sine.easeInOut" });

      const id = (c as any).__tileId as number;
      const slot = this.findBestSlotFor(c.x, c.y);

      if (!slot || slot.occupied) {
        this.returnToHome(id);
        c.setDepth(1);
        return;
      }

      if (slot.id === id) {
        slot.occupied = true;
        this.snapToSlot(c, slot.x, slot.y);

        hitZone.disableInteractive();
        c.setDepth(10);

        this.placedCount++;
        if (this.placedCount === 9) this.win();
      } else {
        this.returnToHome(id);
        c.setDepth(1);
      }
    });

    return c;
  }

  private snapToSlot(tile: Phaser.GameObjects.Container, x: number, y: number) {
    this.scene.tweens.add({
      targets: tile,
      x,
      y,
      duration: 140,
      ease: "Sine.easeInOut",
      onComplete: () => tile.setDepth(10),
    });
  }

  private returnToHome(tileId: number) {
    const tile = this.tiles.find((t) => (t as any).__tileId === tileId);
    if (!tile) return;

    const home = this.homePos.get(tileId);
    if (!home) return;

    this.scene.tweens.add({
      targets: tile,
      x: home.x,
      y: home.y,
      duration: 160,
      ease: "Sine.easeInOut",
      onComplete: () => tile.setDepth(1),
    });
  }

  private findBestSlotFor(x: number, y: number): Slot | null {
    let best: Slot | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const s of this.slots) {
      const dx = s.x - x;
      const dy = s.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }

    const snapRadiusSq = (this.slotSize * 0.75) ** 2;
    if (bestDist > snapRadiusSq) return null;
    return best;
  }

  private win() {
    const msg = this.scene.add
      .text(0, this.grid * (this.slotSize + this.slotGap) / 2 + 30, "אלופה! הבית מסודר 🎉", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#111",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.root.add(msg);

    this.scene.tweens.add({
      targets: this.root,
      scale: 1.02,
      duration: 120,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.scene.time.delayedCall(350, () => {
          this.onComplete?.();
          this.destroy();
        });
      },
    });
  }

  private cellToXY(cell: number, size: number, gap: number) {
    const col = cell % this.grid;
    const row = Math.floor(cell / 3);

    const W = this.grid * size + (this.grid - 1) * gap;
    const left = -W / 2 + size / 2;
    const top = -W / 2 + size / 2;

    return {
      x: left + col * (size + gap),
      y: top + row * (size + gap),
    };
  }

  private shuffle<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  destroy() {
    this.root.destroy(true);
  }
}