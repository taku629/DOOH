import { getParticipantCount, publishSwipeComplete } from "../src/firebase-bridge.js";
import { getChannelForTheme, resolveTheme } from "../src/theme-router.js";

const steps = [...document.querySelectorAll(".step")];
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const progressElement = document.querySelector(".bar");
const counterValue = document.getElementById("counterValue");
const counterBox = document.getElementById("counterBox");
const counterParticipants = document.getElementById("counterParticipants");
const nickname = document.getElementById("nickname");
const previewName = document.getElementById("previewName");
const finalCard = document.getElementById("finalCard");
const shareStatus = document.getElementById("shareStatus");
const swipeControl = document.querySelector(".slider-wrap");
const swipeHint = document.getElementById("swipeHint");
const swipeActionLabel = document.getElementById("swipeActionLabel");
const swipePercent = document.getElementById("swipePercent");
const thanksTitle = document.getElementById("thanksTitle");
const viewport = document.getElementById("viewport");
const track = document.getElementById("track");
const app = document.getElementById("app");
const celebration = document.getElementById("celebration");
const swipeStep = steps[0];

const totalSteps = steps.length;
const FALLBACK_COUNTER_TARGET = 0;
const activeTheme = resolveTheme({ defaultTheme: "night" });
const PARTICIPATION_CHANNEL = getChannelForTheme(activeTheme, "v2");
const DEMO_DONATION_YEN = 100;
const SWIPE_CHARGE_DISTANCE_RATIO = 0.34;
const SWIPE_COMPLETE_SNAP_THRESHOLD = 96;

document.documentElement.dataset.theme = activeTheme;

let currentStep = 0;
let participantCount = FALLBACK_COUNTER_TARGET;
let hasCountedParticipation = false;
let hasShownSwipeReadyEffect = false;
let hasAnimatedCounter = false;
let isFinalCardBuilt = false;
let isRegisteringParticipation = false;
let isAutoCompletingSwipe = false;
let swipeChargeValue = 0;
let counterAnimationFrame = null;

const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);
let prefersReducedMotion = reducedMotionQuery.matches;

function handleReducedMotionChange(event) {
  prefersReducedMotion = event.matches;

  if (!prefersReducedMotion || !counterAnimationFrame || !counterValue || !counterBox) {
    return;
  }

  cancelAnimationFrame(counterAnimationFrame);
  counterAnimationFrame = null;
  counterValue.textContent = getDemoDonationTotal().toLocaleString("ja-JP");
  counterBox.classList.remove("is-counting");
  counterBox.classList.add("is-counted");
}

if (reducedMotionQuery.addEventListener) {
  reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
} else if (reducedMotionQuery.addListener) {
  reducedMotionQuery.addListener(handleReducedMotionChange);
}

function generateRandomGuestName() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `サポーター#${suffix}`;
}

const RANDOM_GUEST_NAME = generateRandomGuestName();

function getDisplayName() {
  return nickname.value.trim() || RANDOM_GUEST_NAME;
}

function getDemoDonationTotal(count = participantCount) {
  return count * DEMO_DONATION_YEN;
}

function normalizeSwipeValue(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function updateSwipeCharge(value) {
  const normalized = normalizeSwipeValue(value);
  const isComplete = normalized >= 100;

  swipeChargeValue = normalized;
  updateSwipeAction(normalized);

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

  return normalized;
}

function updateSwipeAction(value) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  const isComplete = normalized >= 100;

  setSwipeFill(normalized);
  swipeStep.classList.toggle("is-swipe-active", normalized > 0);
  swipeStep.classList.toggle("is-swipe-mid", normalized >= 40);
  swipeStep.classList.toggle("is-swipe-high", normalized >= 72);
  swipeStep.classList.toggle("is-swipe-charged", isComplete);

  if (swipePercent) {
    swipePercent.textContent = `${normalized}%`;
  }

  if (!swipeActionLabel) {
    return;
  }

  if (isComplete) {
    swipeActionLabel.textContent = "チャージ完了。発光を確定できます。";
  } else if (normalized >= 72) {
    swipeActionLabel.textContent = "あと少し。街の色が戻り始めています。";
  } else if (normalized >= 40) {
    swipeActionLabel.textContent = "ネオンが広がっています。そのまま上へ。";
  } else if (normalized > 0) {
    swipeActionLabel.textContent = "そのまま上までスワイプ。";
  } else {
    swipeActionLabel.textContent = "下から上までスワイプする";
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
  track.style.transform = `translate3d(0, calc(${-index * 100}% + ${dragPercent}%), 0)`;
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
  app.classList.toggle("is-post-participation", index >= 1);
  app.classList.toggle("is-share-ready", index === totalSteps - 1);

  if (index === 1 && hasCountedParticipation && !hasAnimatedCounter) {
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

  if (counterAnimationFrame) {
    cancelAnimationFrame(counterAnimationFrame);
    counterAnimationFrame = null;
  }

  if (prefersReducedMotion) {
    counterValue.textContent = target.toLocaleString("ja-JP");
    counterBox.classList.remove("is-counting");
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
      counterAnimationFrame = requestAnimationFrame(tick);
      return;
    }

    counterAnimationFrame = null;
    counterValue.textContent = target.toLocaleString("ja-JP");
    counterBox.classList.remove("is-counting");
    counterBox.classList.add("is-counted");
  }

  counterAnimationFrame = requestAnimationFrame(tick);
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
  label.textContent = activeTheme === "morning"
    ? "SHINJUKU MORNING SUPPORTER"
    : "SHINJUKU COLOR SUPPORTER";

  const name = document.createElement("h3");
  name.textContent = getDisplayName();

  const description = document.createElement("p");
  description.textContent = activeTheme === "morning"
    ? `あなたの¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}デモ募金が、朝の新宿に小さな余白をつくりました。`
    : `あなたの¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}デモ募金で街に色が広がっています。`;

  finalCard.append(label, name, description);
}

function finalizeCard() {
  isFinalCardBuilt = false;
  buildFinalCard();
  nextStep();
}

async function registerParticipation() {
  if (isRegisteringParticipation) {
    return false;
  }
  isRegisteringParticipation = true;

  try {
    const result = await publishSwipeComplete({
      channel: PARTICIPATION_CHANNEL,
      source: activeTheme === "morning" ? "participant-flow-morning" : "participant-flow-v2",
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
    hasAnimatedCounter = false;
    return true;
  } catch (error) {
    console.warn("[firebase] participation count update failed:", error);
    if (swipeHint) {
      swipeHint.textContent = "通信に失敗しました。接続を確認してもう一度お試しください。";
    }
    return false;
  } finally {
    isRegisteringParticipation = false;
  }
}

async function markParticipationComplete() {
  const didComplete = await registerParticipation();
  if (didComplete) {
    nextStep();
  }
  return didComplete;
}

async function completeSwipeCharge() {
  if (isAutoCompletingSwipe || currentStep !== 0) {
    return;
  }

  isAutoCompletingSwipe = true;
  updateSwipeCharge(100);
  if (swipeHint) {
    swipeHint.textContent = "デモ募金を反映しています。";
  }

  const didComplete = await markParticipationComplete();
  if (!didComplete) {
    updateSwipeCharge(84);
    if (swipeHint) {
      swipeHint.textContent = "通信に失敗しました。もう一度上までスワイプしてください。";
    }
  }

  isAutoCompletingSwipe = false;
}

function playCelebration() {
  if (!celebration || prefersReducedMotion) {
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
    if (shareStatus) {
      shareStatus.textContent = "リンクをコピーしました。";
    }
  } catch {
    if (shareStatus) {
      shareStatus.textContent = `コピーできませんでした。URL: ${url}`;
    }
  }
}

function setSwipeFill(value) {
  const normalized = normalizeSwipeValue(value);
  swipeStep?.style.setProperty("--swipe-fill", `${normalized}%`);
  swipeControl?.style.setProperty("--swipe-fill", `${normalized}%`);
}

function canAdvanceFrom(index) {
  if (index === 0) {
    return swipeChargeValue >= 100;
  }
  return true;
}

async function handleForwardAdvance(fromIndex) {
  if (fromIndex === 0) {
    return registerParticipation();
  } else if (fromIndex === 2) {
    buildFinalCard();
  }
  return true;
}

/* Pointer-driven vertical swipe between steps -------------------------- */

const DRAG_AXIS_THRESHOLD = 8;
const SNAP_THRESHOLD_RATIO = 0.18;

let activePointerId = null;
let pointerStartX = 0;
let pointerStartY = 0;
let dragOffset = 0;
let dragAxisLocked = null;
let swipeStartValue = 0;
let isChargingSwipe = false;

function releasePointerCapture(pointerId) {
  if (pointerId === null || pointerId === undefined) {
    return;
  }

  try {
    if (viewport.hasPointerCapture?.(pointerId)) {
      viewport.releasePointerCapture(pointerId);
    }
  } catch {
    /* noop */
  }
}

function resetPointerState(options = {}) {
  const pointerId = activePointerId;
  activePointerId = null;
  pointerStartX = 0;
  pointerStartY = 0;
  dragOffset = 0;
  dragAxisLocked = null;
  swipeStartValue = 0;
  isChargingSwipe = false;

  if (options.releaseCapture !== false) {
    releasePointerCapture(pointerId);
  }
}

function isInteractiveTarget(target) {
  return Boolean(
    target.closest(
      'button, input[type="text"], a, [data-no-swipe]'
    )
  );
}

function startPointer(event) {
  if (activePointerId !== null) {
    return;
  }
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
  swipeStartValue = swipeChargeValue;
  isChargingSwipe = false;

  try {
    viewport.setPointerCapture(event.pointerId);
  } catch {
    /* noop */
  }
}

function movePointer(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  const dx = event.clientX - pointerStartX;
  const dy = event.clientY - pointerStartY;

  if (dragAxisLocked === null) {
    if (Math.abs(dy) > DRAG_AXIS_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
      dragAxisLocked = "y";
      track.classList.add("is-dragging");
    } else if (Math.abs(dx) > DRAG_AXIS_THRESHOLD) {
      dragAxisLocked = "x";
    }
  }

  if (dragAxisLocked !== "y") {
    return;
  }

  event.preventDefault();
  dragOffset = dy;

  const height = viewport.clientHeight || 1;
  if (currentStep === 0 && swipeStartValue < 100 && dragOffset < 0) {
    isChargingSwipe = true;
    const chargeDistance = Math.max(180, height * SWIPE_CHARGE_DISTANCE_RATIO);
    const nextValue = swipeStartValue + (Math.abs(dragOffset) / chargeDistance) * 100;
    const updatedValue = updateSwipeCharge(nextValue);
    setTrackPosition(currentStep);
    if (updatedValue >= 100) {
      completeSwipeCharge();
    }
    return;
  }

  let normalized = dragOffset;

  const atStart = currentStep === 0 && dragOffset > 0;
  const atEndBlocked =
    dragOffset < 0 &&
    (currentStep === totalSteps - 1 || !canAdvanceFrom(currentStep));
  if (atStart || atEndBlocked) {
    normalized = dragOffset * 0.35;
  }

  setTrackPosition(currentStep, (normalized / height) * 100);
}

async function endPointer(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  const wasVertical = dragAxisLocked === "y";
  track.classList.remove("is-dragging");

  if (!wasVertical) {
    resetPointerState();
    return;
  }

  const height = viewport.clientHeight || 1;
  const threshold = height * SNAP_THRESHOLD_RATIO;

  if (isChargingSwipe) {
    const currentValue = swipeChargeValue;
    const shouldSnapComplete =
      currentValue >= SWIPE_COMPLETE_SNAP_THRESHOLD ||
      Math.abs(dragOffset) >= height * SWIPE_CHARGE_DISTANCE_RATIO;

    if (shouldSnapComplete) {
      completeSwipeCharge();
    }

    setTrackPosition(currentStep);
    resetPointerState();
    return;
  }

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

  resetPointerState();
}

function cancelPointer(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  track.classList.remove("is-dragging");
  setTrackPosition(currentStep);
  resetPointerState({ releaseCapture: false });
}

viewport.addEventListener("pointerdown", startPointer);
viewport.addEventListener("pointermove", movePointer);
viewport.addEventListener("pointerup", endPointer);
viewport.addEventListener("pointercancel", cancelPointer);
viewport.addEventListener("lostpointercapture", cancelPointer);

/* Step navigation buttons --------------------------------------------- */

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", nextStep);
});

nickname.addEventListener("input", () => {
  previewName.textContent = getDisplayName();
});

document.getElementById("createCard").addEventListener("click", finalizeCard);
document.getElementById("skipName").addEventListener("click", finalizeCard);

const downloadBtn = document.getElementById("downloadBtn");
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    if (shareStatus) {
      shareStatus.textContent = "デモ版: 参加証画像の保存は次タスクで実装します。";
    }
  });
}

const shareBtn = document.getElementById("shareBtn");
if (shareBtn) {
  shareBtn.addEventListener("click", copyShareLink);
}

window.addEventListener("resize", () => {
  setTrackPosition(currentStep);
});

updateSwipeCharge(0);
applyThemeCopy();
showStep(0);

getParticipantCount({ channel: PARTICIPATION_CHANNEL })
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

function applyThemeCopy() {
  if (activeTheme !== "morning") {
    return;
  }

  const setText = (id, text) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  };
  const eyebrow = document.querySelector(".eyebrow");
  const lead = document.querySelector(".lead");
  const title = document.querySelector("#campaignTitle");
  const firstStepCopy = steps[0]?.querySelector("p");
  const previewLabel = document.querySelector("#certificatePreview p");

  if (eyebrow) {
    eyebrow.textContent = "Morning Shinjuku";
  }
  if (lead) {
    lead.textContent = "通勤前の3秒で参加できる、朝の新宿向けデモ募金体験です。";
  }
  if (title) {
    title.innerHTML = "朝の新宿に<br><span class=\"no-break\">3秒で参加</span>";
  }
  if (firstStepCopy) {
    firstStepCopy.textContent = "画面を開いたら、このカードを下から上へ一気にスワイプしてください。朝の参加としてすぐに反映されます。";
  }
  if (previewLabel) {
    previewLabel.textContent = "SHINJUKU MORNING SUPPORTER";
  }
  setText("swipeTitle", "上にスワイプして100円を届ける");
  setText("swipeActionLabel", "この画面を上にスワイプする");
  setText("swipeHint", "この画面を上にスワイプしてください。");
  setText("thanksTitle", "参加が朝の新宿に反映されました。");
  setText("certificateTitle", "朝の参加証を受け取る");
  setText("shareTitle", "参加証が作成されました。");
}
