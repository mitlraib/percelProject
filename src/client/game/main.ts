import Phaser from "phaser";
import MenuScene from "./scenes/MenuScene";
import PlayerSetupScene from "./scenes/PlayerSetupScene";
import NetworkScene from "./scenes/NetworkScene";
import ParallaxScene from "./scenes/ParallaxScene";

const MOBILE_BREAKPOINT = 768;

export default function startGame() {
  const parent = document.getElementById("game-container");
  const w = parent ? parent.clientWidth : window.innerWidth;
  const h = parent ? parent.clientHeight : window.innerHeight;
  const isMobile = w < MOBILE_BREAKPOINT;

  // במובייל: גודל המשחק = גודל המסך (לא 800x450) כדי שהאדמה תהיה ממש בתחתית בלי פסים שחורים
  const gameW = isMobile ? Math.max(320, w) : Math.max(320, w);
  const gameH = isMobile ? Math.max(400, h) : Math.max(240, h);

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game-container",
    backgroundColor: "#0b0b14",

    scale: {
      mode: isMobile ? Phaser.Scale.FIT : Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: gameW,
      height: gameH,
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