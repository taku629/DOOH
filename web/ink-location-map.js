const WINDOW_COUNT = 18;

function normalizedIndex(swipeCount) {
  const count = Math.floor(Number(swipeCount));
  return Number.isFinite(count) && count > 0 ? (count - 1) % WINDOW_COUNT : -1;
}

export function renderInkLocationMap(root, swipeCount, options = {}) {
  if (!root) return;
  const language = options.language === "en" ? "en" : "ja";
  const resolvedIndex = normalizedIndex(swipeCount);
  // entry=swiped 等で過去の count が取れない場合も、名前入力そのものは隠さない。
  const index = resolvedIndex < 0 ? 0 : resolvedIndex;
  root.hidden = false;

  let silhouette = root.querySelector(".ink-window-silhouette");
  if (!silhouette) {
    silhouette = document.createElement("div");
    silhouette.className = "ink-window-silhouette";
    silhouette.innerHTML = `<span class="ink-window-target-name" data-ink-location-name></span>`;
    root.prepend(silhouette);
  }
  silhouette.dataset.windowShape = String(index);
  root.dataset.locationIndex = String(index);
  root.setAttribute("aria-label", options.title || (language === "en" ? "Add a name to your certificate." : "参加証に表示する名前を追加できます。"));
  root.querySelector("[data-ink-location-title]").textContent = options.title || (language === "en" ? "Name on your certificate" : "参加証に表示する名前");
  root.querySelector("[data-ink-location-position]").textContent = "";
  root.querySelector("[data-ink-location-message]").textContent = options.message || (language === "en" ? "Your name and color will travel to the city on the next screen." : "名前は次の画面で、あなたの彩りと一緒に街へ届きます。");
}

export function setInkLocationName(root, name, language = "ja") {
  if (!root) return;
  const resolvedName = String(name || "").trim().slice(0, 20);
  const targetName = root.querySelector("[data-ink-location-name]");
  if (!targetName) return;
  targetName.textContent = resolvedName;
  targetName.setAttribute("lang", language === "en" ? "en" : "ja");
  root.classList.toggle("has-landed-name", Boolean(resolvedName));
  root.dataset.landedName = resolvedName;
}

export function setInkLocationStatus(root, status, language = "ja") {
  if (!root || root.hidden) return;
  const message = root.querySelector("[data-ink-location-message]");
  if (!message) return;
  root.dataset.status = status || "ready";
  if (status === "sending") {
    message.textContent = language === "en" ? "Creating your certificate…" : "参加証を作成しています…";
  } else if (status === "sent") {
    message.textContent = language === "en" ? "Your name appeared in the color window." : "彩りの窓にあなたの名前が表示されました。";
  } else if (status === "error") {
    message.textContent = language === "en" ? "We could not add your name. Please try again." : "名前を追加できませんでした。もう一度お試しください";
  }
}
