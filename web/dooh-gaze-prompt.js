function copyFor(language) {
  return language === "en"
    ? {
        title: "Your color reached the big screen",
        body: "Look up and find the window glowing with your color.",
        open: "Find it on the big screen",
        optional: "You can also continue without looking up.",
        overlayTitle: "Look up at the big screen",
        overlayBody: "Your color is glowing in one of the windows.",
        close: "Return to your phone",
      }
    : {
        title: "あなたの彩を大画面へ届けました",
        body: "顔を上げて、あなたの彩が灯った窓を探してみよう。",
        open: "大画面で探す",
        optional: "見上げずに、このまま参加証へ進むこともできます。",
        overlayTitle: "大画面を見てみよう",
        overlayBody: "どこかの窓に、あなたの彩が灯っています。",
        close: "スマホに戻る",
      };
}

export function mountDoohGazePrompt(step, options = {}) {
  if (!step) return null;
  const overlay = document.createElement("div");
  overlay.className = "dooh-gaze-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="dooh-gaze-beam" aria-hidden="true"></div>
    <strong data-gaze-overlay-title></strong>
    <p data-gaze-overlay-body></p>
    <button type="button" data-gaze-close></button>
  `;

  document.body.append(overlay);
  overlay.querySelector("[data-gaze-close]").addEventListener("click", () => {
    overlay.classList.remove("is-active");
    window.setTimeout(() => { overlay.hidden = true; }, 240);
  });

  const api = {
    update(language = options.language, override = {}) {
      const copy = { ...copyFor(language), ...override };
      overlay.querySelector("[data-gaze-overlay-title]").textContent = copy.overlayTitle;
      overlay.querySelector("[data-gaze-overlay-body]").textContent = copy.overlayBody;
      overlay.querySelector("[data-gaze-close]").textContent = copy.close;
    },
    show() {
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add("is-active"));
      navigator.vibrate?.([35, 45, 35]);
    },
  };
  api.update(options.language);
  return api;
}
