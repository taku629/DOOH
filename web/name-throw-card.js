const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function mountNameThrowCard({ card, button, submit, getCopy }) {
  if (!card || !button || typeof submit !== "function") return null;
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "name-throw-handle";
  handle.innerHTML = '<span aria-hidden="true">↑</span><strong></strong><small></small>';
  card.prepend(handle);

  let running = false;
  let startY = 0;
  let startX = 0;

  const update = () => {
    const copy = getCopy?.() || {};
    handle.querySelector("strong").textContent = copy.gesture || "";
    handle.querySelector("small").textContent = copy.fallback || "";
    handle.setAttribute("aria-label", copy.label || copy.gesture || "");
  };

  const run = async () => {
    if (running) return false;
    running = true;
    card.classList.remove("is-returning");
    card.classList.add("is-throwing");
    const [ok] = await Promise.all([Promise.resolve().then(submit).catch(() => false), wait(680)]);
    if (!ok) {
      card.classList.remove("is-throwing");
      card.classList.add("is-returning");
      window.setTimeout(() => card.classList.remove("is-returning"), 650);
    }
    running = false;
    return ok;
  };

  handle.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    handle.setPointerCapture?.(event.pointerId);
  });
  handle.addEventListener("pointerup", (event) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (dy < -64 && Math.abs(dy) > Math.abs(dx) * 1.25) run();
  });
  handle.addEventListener("click", (event) => {
    // Keyboard activation remains available; pointer taps do not accidentally submit.
    if (event.detail === 0) run();
  });
  button.addEventListener("click", run);
  update();
  return { run, update };
}
