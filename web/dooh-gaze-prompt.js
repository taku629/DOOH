function copyFor(language) {
  return { overlayTitle: "", overlayBody: "", close: "", quietTitle: "", quietBody: "" };
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
    window.clearTimeout(api.quietTimer);
    window.clearTimeout(api.vibrateTimer);
    overlay.classList.remove("is-active");
    window.setTimeout(() => { overlay.hidden = true; }, 240);
  });

  const api = {
    update(language = options.language, override = {}) {
      const copy = { ...copyFor(language), ...override };
      const quiet = overlay.classList.contains("is-quiet-exit");
      overlay.querySelector("[data-gaze-overlay-title]").textContent = quiet ? copy.quietTitle : copy.overlayTitle;
      overlay.querySelector("[data-gaze-overlay-body]").textContent = quiet ? copy.quietBody : copy.overlayBody;
      overlay.querySelector("[data-gaze-close]").textContent = copy.close;
      api.copy = copy;
    },
    show({ onQuietExit, timeoutMs = 30_000 } = {}) {
      window.clearTimeout(api.quietTimer);
      window.clearTimeout(api.vibrateTimer);
      overlay.classList.remove("is-quiet-exit");
      overlay.querySelector("[data-gaze-overlay-title]").textContent = api.copy?.overlayTitle || "";
      overlay.querySelector("[data-gaze-overlay-body]").textContent = api.copy?.overlayBody || "";
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add("is-active"));
      api.vibrateTimer = window.setTimeout(() => navigator.vibrate?.(35), 2400);
      api.quietTimer = window.setTimeout(() => {
        overlay.classList.add("is-quiet-exit");
        overlay.querySelector("[data-gaze-overlay-title]").textContent = api.copy?.quietTitle || "";
        overlay.querySelector("[data-gaze-overlay-body]").textContent = api.copy?.quietBody || "";
        onQuietExit?.();
      }, timeoutMs);
    },
    copy: null,
    quietTimer: null,
    vibrateTimer: null,
  };
  api.update(options.language);
  return api;
}
