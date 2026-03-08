// src/client/utils/FullscreenController.ts

export default class FullscreenController {
    private target: HTMLElement | null;
    private button: HTMLButtonElement | null;
  
    constructor(targetId = "game-container", buttonId = "fullscreen-btn") {
      this.target = document.getElementById(targetId);
      this.button = document.getElementById(buttonId) as HTMLButtonElement | null;
  
      this.handleToggleClick = this.handleToggleClick.bind(this);
      this.handleFullscreenChange = this.handleFullscreenChange.bind(this);
      this.handleFullscreenError = this.handleFullscreenError.bind(this);
    }
  
    init() {
      if (!this.target) {
        console.error("Fullscreen target element not found.");
        return;
      }
  
      if (!this.button) {
        console.warn("Fullscreen button not found.");
        return;
      }
  
      this.button.addEventListener("click", this.handleToggleClick);
      document.addEventListener("fullscreenchange", this.handleFullscreenChange);
      document.addEventListener("fullscreenerror", this.handleFullscreenError);
  
      this.updateButtonText();
    }
  
    destroy() {
      if (this.button) {
        this.button.removeEventListener("click", this.handleToggleClick);
      }
  
      document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
      document.removeEventListener("fullscreenerror", this.handleFullscreenError);
    }
  
    private async handleToggleClick() {
      await this.toggle();
    }
  
    async toggle() {
      if (!this.target) return;
  
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await this.target.requestFullscreen({
            navigationUI: "hide",
          });
        }
      } catch (error) {
        console.error("Failed to toggle fullscreen:", error);
      }
    }
  
    isFullscreen() {
      return !!document.fullscreenElement;
    }
  
    private handleFullscreenChange() {
      this.updateButtonText();
    }
  
    private handleFullscreenError(event: Event) {
      console.error("Fullscreen error:", event);
      this.updateButtonText();
    }
  
    private updateButtonText() {
      if (!this.button) return;
  
      this.button.textContent = this.isFullscreen()
        ? "יציאה ממסך מלא"
        : "מסך מלא";
    }
  }