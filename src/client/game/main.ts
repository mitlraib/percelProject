import Phaser from "phaser";
import MenuScene from "./scenes/MenuScene";
import PlayerSetupScene from "./scenes/PlayerSetupScene";
import NetworkScene from "./scenes/NetworkScene";
import ParallaxScene from "./scenes/ParallaxScene";

const MOBILE_BREAKPOINT = 768;
const FIT_WIDTH = 800;
const FIT_HEIGHT = 450;

export default function startGame() {
  const parent = document.getElementById("game-container");
  const w = parent ? parent.clientWidth : window.innerWidth;
  const h = parent ? parent.clientHeight : window.innerHeight;
  const isMobile = w < MOBILE_BREAKPOINT;

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game-container",
    backgroundColor: "#222222",

    scale: {
      mode: isMobile ? Phaser.Scale.FIT : Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: isMobile ? FIT_WIDTH : Math.max(320, w),
      height: isMobile ? FIT_HEIGHT : Math.max(240, h),
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

  return new Phaser.Game(config);
}