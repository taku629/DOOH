import { getParticipantCount, publishSwipeComplete } from "../src/firebase-bridge.js";

const steps = [...document.querySelectorAll(".step")];
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const progressElement = document.querySelector(".bar");
const counterValue = document.getElementById("counterValue");
const counterBox = document.getElementById("counterBox");
const counterBadge = counterBox?.querySelector("em");
const counterParticipants = document.getElementById("counterParticipants");
const nickname = document.getElementById("nickname");
const previewName = document.getElementById("previewName");
const finalCard = document.getElementById("finalCard");
const shareStatus = document.getElementById("shareStatus");
const swipeSlider = document.getElementById("swipeSlider");
const swipeCompleteButton = document.getElementById("swipeComplete");
const swipeHint = document.getElementById("swipeHint");
const thanksTitle = document.getElementById("thanksTitle");
const viewport = document.getElementById("viewport");
const track = document.getElementById("track");
const app = document.getElementById("app");
const celebration = document.getElementById("celebration");

const totalSteps = steps.length;
const FALLBACK_COUNTER_TARGET = 0;
const PARTICIPATION_STORAGE_KEY = "dooh:participant-flow:participated";
const DEMO_DONATION_YEN = 100;

let currentStep = 0;
let participantCount = FALLBACK_COUNTER_TARGET;
let hasCountedParticipation = false;
let hasShownSwipeReadyEffect = false;
let hasAnimatedCounter = false;
let isFinalCardBuilt = false;
let isRegisteringParticipation = false;

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

function getDisplayName() {
  return nickname.value.trim() || "匿名サポーター";
}

function getDemoDonationTotal(count = participantCount) {
  return count * DEMO_DONATION_YEN;
}

function hasStoredParticipation() {
  try {
    return localStorage.getItem(PARTICIPATION_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function storeParticipation() {
  try {
    localStorage.setItem(PARTICIPATION_STORAGE_KEY, "true");
  } catch {
    /* Storage can be unavailable in private browsing; Firebase remains source of truth. */
  }
}

function applyStoredParticipationState() {
  if (!hasStoredParticipation()) {
    return;
  }

  hasCountedParticipation = true;
  swipeSlider.value = "100";
  swipeSlider.disabled = true;
  setSwipeFill(100);
  swipeCompleteButton.disabled = false;
  swipeCompleteButton.setAttribute("aria-disabled", "false");
  swipeCompleteButton.textContent = "デモ募金済み。次へ";

  if (swipeHint) {
    swipeHint.textContent = "この端末ではデモ募金済みです。カウントは追加されません。";
  }
  if (thanksTitle) {
    thanksTitle.textContent = "デモ募金済みです。新宿に灯りが増えています。";
  }
  if (counterBadge) {
    counterBadge.textContent = "済";
  }
  if (counterParticipants) {
    counterParticipants.textContent = participantCount.toLocaleString("ja-JP");
  }
}

function updateProgress(index) {
  const current = index + 1;
  const label = steps[index]?.dataset.label || `ステップ${current}`;

  progressText.textContent = `${current} / ${totalSteps} ・ ${label}`;
  progressBar.style.width = `${(current / totalSteps) * 100}%`;
  progressElement.setAttribute("aria-valuemax", String(totalSteps));
  progressElement.setAttribute("aria-valuenow", String(current));
}

function setTrackPosition(index, dragPercent = 0) {
  track.style.transform = `translate3d(calc(${-index * 100}% + ${dragPercent}%), 0, 0)`;
}

function showStep(index) {
  currentStep = index;
  steps.forEach((step, stepIndex) => {
    const isCurrent = stepIndex === index;
    step.classList.toggle("is-current", isCurrent);
    step.setAttribute("aria-hidden", String(!isCurrent));
  });

  setTrackPosition(index);
  updateProgress(index);
  app.classList.toggle("is-post-participation", index >= 2);
  app.classList.toggle("is-share-ready", index === totalSteps - 1);

  if (index === 2 && hasCountedParticipation && !hasAnimatedCounter) {
    hasAnimatedCounter = true;
    const delay = prefersReducedMotion ? 0 : 420;
    if (counterParticipants) {
      counterParticipants.textContent = participantCount.toLocaleString("ja-JP");
    }
    window.setTimeout(() => animateCounter(getDemoDonationTotal()), delay);
  }
}

function animateCounter(target) {
  if (!counterValue || !counterBox) {
    return;
  }

  if (prefersReducedMotion) {
    counterValue.textContent = target.toLocaleString("ja-JP");
    counterBox.classList.add("is-counted");
    return;
  }

  counterBox.classList.add("is-counting");

  const startValue = 0;
  const duration = 1900;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const value = Math.floor(startValue + (target - startValue) * eased);
    counterValue.textContent = value.toLocaleString("ja-JP");

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    counterValue.textContent = target.toLocaleString("ja-JP");
    counterBox.classList.remove("is-counting");
    counterBox.classList.add("is-counted");
  }

  requestAnimationFrame(tick);
}

function nextStep() {
  if (currentStep < totalSteps - 1) {
    showStep(currentStep + 1);
  }
}

function buildFinalCard() {
  if (isFinalCardBuilt) {
    return;
  }
  isFinalCardBuilt = true;
  finalCard.replaceChildren();

  const label = document.createElement("p");
  label.textContent = "SHINJUKU COLOR SUPPORTER";

  const name = document.createElement("h3");
  name.textContent = getDisplayName();

  const description = document.createElement("p");
  description.textContent = `あなたの¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}デモ募金で街に色が広がっています。`;

  finalCard.append(label, name, description);
}

function finalizeCard() {
  isFinalCardBuilt = false;
  buildFinalCard();
  nextStep();
}

async function registerParticipation() {
  if (hasStoredParticipation()) {
    hasCountedParticipation = true;
    applyStoredParticipationState();
    return true;
  }
  if (hasCountedParticipation || isRegisteringParticipation) {
    return hasCountedParticipation;
  }
  isRegisteringParticipation = true;
  swipeCompleteButton.disabled = true;
  swipeCompleteButton.setAttribute("aria-disabled", "true");

  try {
    const result = await publishSwipeComplete({
      name: getDisplayName(),
      donationAmountYen: DEMO_DONATION_YEN,
    });
    const committedCount = Number(result?.count);
    participantCount = Number.isFinite(committedCount)
      ? committedCount
      : participantCount + 1;
    if (counterParticipants) {
      counterParticipants.textContent = participantCount.toLocaleString("ja-JP");
    }
    hasCountedParticipation = true;
    storeParticipation();
    return true;
  } catch (error) {
    console.warn("[firebase] participation count update failed:", error);
    if (swipeHint) {
      swipeHint.textContent = "通信に失敗しました。接続を確認してもう一度お試しください。";
    }
    return false;
  } finally {
    isRegisteringParticipation = false;
    const canComplete = Number(swipeSlider.value) >= 100;
    swipeCompleteButton.disabled = !canComplete;
    swipeCompleteButton.setAttribute("aria-disabled", String(!canComplete));
  }
}

async function markParticipationComplete() {
  const didComplete = await registerParticipation();
  if (didComplete) {
    nextStep();
  }
}

function playCelebration() {
  if (!celebration) {
    return;
  }

  [...celebration.children].forEach((item, index) => {
    item.style.setProperty("--angle", `${index * 60}deg`);
  });
  celebration.classList.remove("is-active");
  void celebration.offsetWidth;
  celebration.classList.add("is-active");
  window.setTimeout(() => celebration.classList.remove("is-active"), 950);
}

async function copyShareLink() {
  const url = location.href;

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API is unavailable.");
    }

    await navigator.clipboard.writeText(url);
    shareStatus.textContent = "リンクをコピーしました。";
  } catch {
    shareStatus.textContent = `コピーできませんでした。URL: ${url}`;
  }
}

function setSwipeFill(value) {
  swipeSlider.style.setProperty("--swipe-fill", `${value}%`);
}

function canAdvanceFrom(index) {
  if (index === 1) {
    if (hasStoredParticipation()) {
      return true;
    }
    return Number(swipeSlider.value) >= 100;
  }
  return true;
}

async function handleForwardAdvance(fromIndex) {
  if (fromIndex === 1) {
    return registerParticipation();
  } else if (fromIndex === 3) {
    buildFinalCard();
  }
  return true;
}

/* Pointer-driven horizontal swipe between steps ------------------------ */

const DRAG_AXIS_THRESHOLD = 8;
const SNAP_THRESHOLD_RATIO = 0.18;

let activePointerId = null;
let pointerStartX = 0;
let pointerStartY = 0;
let dragOffset = 0;
let dragAxisLocked = null;

function isInteractiveTarget(target) {
  return Boolean(
    target.closest(
      'input[type="range"], button, input[type="text"], a, [data-no-swipe]'
    )
  );
}

function startPointer(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }
  if (isInteractiveTarget(event.target)) {
    return;
  }

  activePointerId = event.pointerId;
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  dragOffset = 0;
  dragAxisLocked = null;
}

function movePointer(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  const dx = event.clientX - pointerStartX;
  const dy = event.clientY - pointerStartY;

  if (dragAxisLocked === null) {
    if (Math.abs(dx) > DRAG_AXIS_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      dragAxisLocked = "x";
      track.classList.add("is-dragging");
      try {
        viewport.setPointerCapture(event.pointerId);
      } catch {
        /* noop */
      }
    } else if (Math.abs(dy) > DRAG_AXIS_THRESHOLD) {
      dragAxisLocked = "y";
    }
  }

  if (dragAxisLocked !== "x") {
    return;
  }

  event.preventDefault();
  dragOffset = dx;

  const width = viewport.clientWidth || 1;
  let normalized = dragOffset;

  const atStart = currentStep === 0 && dragOffset > 0;
  const atEndBlocked =
    dragOffset < 0 &&
    (currentStep === totalSteps - 1 || !canAdvanceFrom(currentStep));
  if (atStart || atEndBlocked) {
    normalized = dragOffset * 0.35;
  }

  setTrackPosition(currentStep, (normalized / width) * 100);
}

async function endPointer(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  const wasHorizontal = dragAxisLocked === "x";
  track.classList.remove("is-dragging");

  if (!wasHorizontal) {
    activePointerId = null;
    return;
  }

  const width = viewport.clientWidth || 1;
  const threshold = width * SNAP_THRESHOLD_RATIO;

  let target = currentStep;
  if (dragOffset < -threshold && currentStep < totalSteps - 1) {
    if (canAdvanceFrom(currentStep)) {
      const didAdvance = await handleForwardAdvance(currentStep);
      if (didAdvance) {
        target = currentStep + 1;
      }
    }
  } else if (dragOffset > threshold && currentStep > 0) {
    target = currentStep - 1;
  }

  showStep(target);

  activePointerId = null;
  pointerStartX = 0;
  pointerStartY = 0;
  dragOffset = 0;
  dragAxisLocked = null;
}

viewport.addEventListener("pointerdown", startPointer);
viewport.addEventListener("pointermove", movePointer);
viewport.addEventListener("pointerup", endPointer);
viewport.addEventListener("pointercancel", endPointer);

/* Step navigation buttons --------------------------------------------- */

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", nextStep);
});

swipeSlider.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  const isComplete = value >= 100;
  const swipeStep = steps[1];

  setSwipeFill(value);
  swipeCompleteButton.disabled = !isComplete;
  swipeCompleteButton.setAttribute("aria-disabled", String(!isComplete));

  if (isComplete && !hasShownSwipeReadyEffect) {
    hasShownSwipeReadyEffect = true;
    swipeStep.classList.add("is-swipe-ready");
    playCelebration();
    window.setTimeout(() => swipeStep.classList.remove("is-swipe-ready"), 950);
  }

  if (!isComplete) {
    hasShownSwipeReadyEffect = false;
    swipeStep.classList.remove("is-swipe-ready");
  }
});

swipeCompleteButton.addEventListener("click", markParticipationComplete);

nickname.addEventListener("input", () => {
  previewName.textContent = getDisplayName();
});

document.getElementById("createCard").addEventListener("click", finalizeCard);
document.getElementById("skipName").addEventListener("click", finalizeCard);

document.getElementById("downloadBtn").addEventListener("click", () => {
  shareStatus.textContent = "デモ版: 参加証画像の保存は次タスクで実装します。";
});

document.getElementById("shareBtn").addEventListener("click", copyShareLink);

window.addEventListener("resize", () => {
  setTrackPosition(currentStep);
});

setSwipeFill(0);
applyStoredParticipationState();
showStep(0);

getParticipantCount()
  .then((count) => {
    if (Number.isFinite(count) && count > 0 && !hasCountedParticipation) {
      participantCount = count;
    }
    if (Number.isFinite(count) && count > 0 && hasCountedParticipation) {
      participantCount = count;
      if (counterParticipants) {
        counterParticipants.textContent = participantCount.toLocaleString("ja-JP");
      }
    }
  })
  .catch((error) => {
    console.warn("[firebase] participant count fetch failed:", error);
  });
