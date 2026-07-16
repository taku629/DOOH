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
    silhouette.setAttribute("aria-hidden", "true");
    root.prepend(silhouette);
  }
  silhouette.dataset.windowShape = String(index);
  root.dataset.locationIndex = String(index);
  root.setAttribute("aria-label", options.title || (language === "en" ? "Your color landed." : "あなたの彩が着弾しました。"));
  root.querySelector("[data-ink-location-title]").textContent = options.title || (language === "en" ? "Landed. This color still has no name." : "着弾しました。この彩は、まだ名無しです");
  root.querySelector("[data-ink-location-position]").textContent = "";
  root.querySelector("[data-ink-location-message]").textContent = options.message || (language === "en" ? "Light your name in this color to complete your certificate." : "この彩に名前を灯して、参加証を完成させよう");
}

export function setInkLocationStatus(root, status, language = "ja") {
  if (!root || root.hidden) return;
  const message = root.querySelector("[data-ink-location-message]");
  if (!message) return;
  root.dataset.status = status || "ready";
  if (status === "sending") {
    message.textContent = language === "en" ? "Pouring your name into the color…" : "名前を彩に注いでいます…";
  } else if (status === "sent") {
    message.textContent = language === "en" ? "Your name is glowing in the color. Look up at the big screen." : "あなたの名前が彩に灯りました。大画面を見てみよう";
  } else if (status === "error") {
    message.textContent = language === "en" ? "We could not add your name. Please try again." : "名前を追加できませんでした。もう一度お試しください";
  }
}
