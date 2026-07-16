export function renderInkLocationMap(root, swipeCount, options = {}) {
  if (!root) return;
  const language = options.language === "en" ? "en" : "ja";
  root.hidden = false;

  let symbol = root.querySelector(".ink-sent-symbol");
  if (!symbol) {
    symbol = document.createElement("div");
    symbol.className = "ink-sent-symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.innerHTML = "<i></i><i></i><i></i>";
    root.prepend(symbol);
  }
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
    message.textContent = language === "en" ? "Sending your name…" : "名前を送っています…";
  } else if (status === "sent") {
    message.textContent = language === "en" ? "We received your name." : "名前を受け付けました。";
  } else if (status === "error") {
    message.textContent = language === "en" ? "We could not add your name. Please try again." : "名前を追加できませんでした。もう一度お試しください";
  }
}
