import SceneUI from "../../controllers/SceneUI";
import PlayerManager from "../../controllers/PlayerManager";
import type { Mode } from "./ParallaxTypes";
import { REGISTRY_DISPLAY_NAME } from "../PlayerSetupScene";

export default class ParallaxHudController {
  private scene: Phaser.Scene;
  private ui: SceneUI;
  private players: PlayerManager;

  constructor(scene: Phaser.Scene, ui: SceneUI, players: PlayerManager) {
    this.scene = scene;
    this.ui = ui;
    this.players = players;
  }

  refresh(params: {
    mode: Mode;
    playerCount: number;
    myPlayerIndex: number | null;
    currentTurnName: string;
  }) {
    const names = this.getCharNames(
      params.mode,
      params.playerCount,
      params.myPlayerIndex
    );

    const me = params.mode === "solo" ? 0 : params.myPlayerIndex;
    const myIdx = me ?? 0;

    const myName = names[myIdx] ?? "שחקן";
    const points = this.players?.getSteps(myIdx) ?? 0;

    const icons = ["👧", "🐶", "🐻", "🎮"];
    const icon = icons[myIdx] ?? "🎮";

    const myLine = `${icon} ${myName}  •  ${points} נק'`;
    const turnLine = params.currentTurnName
      ? `🎯 תור  •  ${params.currentTurnName}`
      : "";

    this.ui.setHUD(myLine, turnLine);
  }

  showSmallStatus(message: string) {
    const txt = this.scene.add
      .text(this.scene.scale.width * 0.5, this.scene.scale.height * 0.18, message, {
        fontFamily: "Arial",
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20000)
      .setAlpha(0);

    this.scene.tweens.add({
      targets: txt,
      alpha: 1,
      y: txt.y - 10,
      duration: 180,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.scene.time.delayedCall(900, () => {
          this.scene.tweens.add({
            targets: txt,
            alpha: 0,
            y: txt.y - 10,
            duration: 180,
            ease: "Sine.easeIn",
            onComplete: () => txt.destroy(),
          });
        });
      },
    });
  }

  getCharNames(mode: Mode, playerCount: number, myPlayerIndex: number | null): string[] {
    if (mode === "solo") return ["מיטול", "בוטית רעה"];

    const base =
      playerCount === 1
        ? ["ילדה"]
        : playerCount === 2
          ? ["ילדה", "כלב"]
          : playerCount === 3
            ? ["ילדה", "כלב", "דוב"]
            : ["ילדה", "כלב", "דוב", "שחקן 4"];

    const me = myPlayerIndex;
    const customName = this.scene.registry.get(REGISTRY_DISPLAY_NAME) as string | undefined;
    if (me !== null && customName) base[me] = customName;

    return base;
  }

  getTexturesForCount(mode: Mode, playerCount: number) {
    if (mode === "solo") return ["ילדה", "כלב"];
    if (playerCount === 1) return ["ילדה"];
    if (playerCount === 2) return ["ילדה", "כלב"];
    if (playerCount === 3) return ["ילדה", "כלב", "דוב"];
    return ["ילדה", "כלב", "דוב", "דוב"];
  }
}