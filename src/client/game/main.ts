import Phaser from "phaser";
import MenuScene from "./scenes/MenuScene";
import NetworkScene from "./scenes/NetworkScene";
import ParallaxScene from "./scenes/ParallaxScene";

export default function startGame() {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game-container",
    backgroundColor: "#222222",

    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 800,
      height: 520,
    },

    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 200 }, debug: false },
    },

    scene: [MenuScene, NetworkScene, ParallaxScene],
  };

  return new Phaser.Game(config);
}