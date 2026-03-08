// src/client/game/ui/TextAnswerInput.ts

export default class TextAnswerInput {
    static open(onSubmit: (value: string) => void) {
      const input = document.createElement("input");
  
      input.type = "text";
      input.placeholder = "כתבי תשובה...";
      input.style.position = "absolute";
      input.style.left = "50%";
      input.style.top = "70%";
      input.style.transform = "translate(-50%, -50%)";
      input.style.fontSize = "20px";
      input.style.padding = "10px";
      input.style.zIndex = "1000";
      input.style.borderRadius = "8px";
      input.style.border = "2px solid #444";
  
      document.body.appendChild(input);
  
      input.focus(); // ← פותח מקלדת במובייל
  
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const value = input.value;
          document.body.removeChild(input);
          onSubmit(value);
        }
      });
    }
  }