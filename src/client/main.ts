import startGame from "./game/main";
import FullscreenController from "./utils/FullscreenController";

window.addEventListener("load", () => {
  startGame();

  const fullscreenController = new FullscreenController(
    "game-container",
    "fullscreen-btn"
  );

  fullscreenController.init();
});