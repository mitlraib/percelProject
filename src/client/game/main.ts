import Phaser from "phaser";
import MenuScene from "./scenes/MenuScene";
import PlayerSetupScene from "./scenes/PlayerSetupScene";
import NetworkScene from "./scenes/NetworkScene";
import ParallaxScene from "./scenes/ParallaxScene";

function getViewportSize() {
  const vv = window.visualViewport;
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
  };
}

export default function startGame() {
  const parent = document.getElementById("game-container");
  const viewport = getViewportSize();

  const width = parent
    ? Math.max(320, Math.round(parent.clientWidth || viewport.width))
    : Math.max(320, viewport.width);

  const height = parent
    ? Math.max(240, Math.round(parent.clientHeight || viewport.height))
    : Math.max(240, viewport.height);

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game-container",
    backgroundColor: "#0b0b14",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width,
      height,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 200 },
        debug: false,
      },
    },
    scene: [MenuScene, PlayerSetupScene, NetworkScene, ParallaxScene],
  };

  const game = new Phaser.Game(config);

  const syncGameSize = () => {
    const container = document.getElementById("game-container");
    const nextViewport = getViewportSize();

    const nextWidth = container
      ? Math.max(320, Math.round(container.clientWidth || nextViewport.width))
      : Math.max(320, nextViewport.width);

    const nextHeight = container
      ? Math.max(240, Math.round(container.clientHeight || nextViewport.height))
      : Math.max(240, nextViewport.height);

    game.scale.resize(nextWidth, nextHeight);

    if (game.canvas) {
      game.canvas.style.width = `${nextWidth}px`;
      game.canvas.style.height = `${nextHeight}px`;
      game.canvas.style.display = "block";
    }
  };

  const delayedSync = () => {
    syncGameSize();
    window.setTimeout(syncGameSize, 80);
    window.setTimeout(syncGameSize, 180);
    window.setTimeout(syncGameSize, 320);
  };

  window.addEventListener("resize", delayedSync);
  window.addEventListener("orientationchange", delayedSync);
  window.addEventListener("fullscreenchange", delayedSync);
  window.visualViewport?.addEventListener("resize", delayedSync);

  delayedSync();

  return game;
}