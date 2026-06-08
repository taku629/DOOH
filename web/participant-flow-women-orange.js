import { getDonationMilestoneGoal } from "../src/condition-manager.js";
import { getParticipantCount, publishSwipeComplete, subscribeToParticipantCount } from "../src/firebase-bridge.js";
import { triggerCompletionHaptic, triggerProgressHaptic } from "../src/haptic.js";
import { isInappropriateName } from "../src/name-filter.js";
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
const thanksTitle = document.getElementById("thanksTitle");
const viewport = document.getElementById("viewport");
const track = document.getElementById("track");
const app = document.getElementById("app");
const celebration = document.getElementById("celebration");
const swipeStep = steps[0];

const totalSteps = steps.length;
const FALLBACK_COUNTER_TARGET = 0;
const activeTheme = resolveTheme({ defaultTheme: "day" });
const PARTICIPATION_CHANNEL = getChannelForTheme(activeTheme, "default");
const DEMO_DONATION_YEN = 100;
const PLAYLIST_PATH = new URL("../config/playlist.json", import.meta.url).href;
const SWIPE_CHARGE_DISTANCE_RATIO = 0.34;
const SWIPE_COMPLETE_SNAP_THRESHOLD = 96;
const STORY_CARD_VISIBLE_MS = 2300;
const STORY_CARD_REDUCED_MOTION_MS = 1000;
const STORY_IMAGE_WIDTH = 1080;
const STORY_IMAGE_HEIGHT = 1920;

document.documentElement.dataset.theme = activeTheme;
const experience = document.documentElement.dataset.experience || "default";
const isSparkleExperience = experience === "sparkle";
const isMenExperience = experience === "men";
const isAllExperience = experience === "all";
const isStoryExperience = isSparkleExperience || isMenExperience || isAllExperience;
const THANKS_STORIES = [
  {
    id: "patrol",
    title: "夜の歌舞伎町を見守る取り組み",
    description: "新宿で続く夜間パトロールを知り、応援する意思を示しました。",
    descriptionMen: "新宿で続く夜間パトロールを知り、応援する意思を示しました。",
    descriptionAll: "新宿で続く夜間パトロールを知り、応援する意思を示しました。",
  },
  {
    id: "graffiti",
    title: "壁の落書き消去",
    description: "落書き消去など、街の環境を整える活動を知り、応援する意思を示しました。",
  },
  {
    id: "outreach",
    title: "NPOによる声かけ・支援",
    description: "若者を支えるNPOの活動を知り、応援する意思を示しました。",
  },
];
const storyCardOverlay = document.getElementById("storyCardOverlay");
const storyCard = document.getElementById("storyCard");
const storyCardTitle = document.getElementById("storyCardTitle");
const storyCardDescription = document.getElementById("storyCardDescription");
const storyFilm = document.getElementById("storyFilm");
const shouldUseStoryThanksCard = Boolean(
  isStoryExperience &&
    activeTheme !== "morning" &&
    storyCardOverlay &&
    storyCard &&
    storyCardTitle &&
    storyCardDescription &&
    storyFilm
);

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
let storyCardDismissTimer = null;
let relightPlaylist = null;
const milestonePreview = buildMilestonePreview();
const milestonePrimary = milestonePreview?.querySelector("[data-milestone-primary]");
const milestoneSecondary = milestonePreview?.querySelector("[data-milestone-secondary]");
const milestoneProgressBar = milestonePreview?.querySelector("[data-milestone-bar]");

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
  const input = nickname.value.trim();
  if (!input || isInappropriateName(input)) {
    return RANDOM_GUEST_NAME;
  }
  return input;
}

function getDemoDonationTotal(count = participantCount) {
  return count * DEMO_DONATION_YEN;
}

function buildMilestonePreview() {
  if (!swipeStep) {
    return null;
  }

  const preview = document.createElement("div");
  preview.className = "milestone-preview";
  preview.id = "milestonePreview";
  preview.setAttribute("aria-live", "polite");

  const kicker = document.createElement("span");
  kicker.textContent = "点灯チャレンジ";

  const primary = document.createElement("strong");
  primary.dataset.milestonePrimary = "";
  primary.textContent = "あと9人で新宿が点灯";

  const secondary = document.createElement("small");
  secondary.dataset.milestoneSecondary = "";
  secondary.textContent = "現在 0人 / 9人で点灯";

  const progress = document.createElement("div");
  progress.className = "milestone-progress";
  progress.setAttribute("aria-hidden", "true");

  const bar = document.createElement("span");
  bar.dataset.milestoneBar = "";
  progress.append(bar);

  preview.append(kicker, primary, secondary, progress);

  // viewport の中(スワイプ画面)に入れるとスワイプ領域を圧迫するので、
  // viewport の直下に置いて、スワイプ UI は無傷のままチャレンジ進捗を表示する。
  const viewportEl = document.getElementById("viewport");
  if (viewportEl && viewportEl.parentNode) {
    viewportEl.after(preview);
  } else {
    swipeStep.append(preview);
  }

  return preview;
}

function updateMilestonePreview(count = participantCount) {
  if (!milestonePreview) {
    return;
  }

  const safeCount = Math.max(0, Number(count) || 0);
  const goal = getDonationMilestoneGoal(relightPlaylist, safeCount, DEMO_DONATION_YEN);
  const formattedCount = safeCount.toLocaleString("ja-JP");
  const formattedTarget = goal.targetCount.toLocaleString("ja-JP");

  milestonePreview.classList.toggle("is-reached", goal.reached);
  milestonePreview.style.setProperty("--milestone-progress", `${goal.progress}%`);

  if (milestonePrimary) {
    milestonePrimary.textContent = goal.reached
      ? "新宿が点灯しました"
      : `あと${goal.remainingCount.toLocaleString("ja-JP")}人で新宿が点灯`;
  }

  if (milestoneSecondary) {
    milestoneSecondary.textContent = goal.reached
      ? `現在 ${formattedCount}人参加 / ${formattedTarget}人達成`
      : `現在 ${formattedCount}人 / ${formattedTarget}人で点灯`;
  }

  if (milestoneProgressBar) {
    milestoneProgressBar.style.width = `${goal.progress}%`;
  }
}

function syncParticipantCount(count, options = {}) {
  const numericCount = Number(count);
  if (!Number.isFinite(numericCount)) {
    return;
  }

  const safeCount = Math.max(0, numericCount);
  participantCount = options.preserveLocal
    ? Math.max(participantCount, safeCount)
    : safeCount;

  if (counterParticipants && (options.forceCounter || hasCountedParticipation || currentStep === 1)) {
    counterParticipants.textContent = participantCount.toLocaleString("ja-JP");
  }

  updateMilestonePreview(participantCount);
}

async function loadRelightPlaylist() {
  try {
    const response = await fetch(PLAYLIST_PATH, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`playlist load failed: ${response.status}`);
    }
    relightPlaylist = await response.json();
    updateMilestonePreview(participantCount);
  } catch (error) {
    console.warn("[playlist] relight milestone load failed:", error);
  }
}

function normalizeSwipeValue(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function updateSwipeCharge(value) {
  const normalized = normalizeSwipeValue(value);
  const isComplete = normalized >= 100;

  swipeChargeValue = normalized;
  setSwipeFill(normalized);
  swipeStep.classList.toggle("is-swipe-active", normalized > 0);
  swipeStep.classList.toggle("is-swipe-charged", isComplete);

  triggerProgressHaptic(normalized);

  if (isComplete && !hasShownSwipeReadyEffect) {
    hasShownSwipeReadyEffect = true;
    swipeStep.classList.add("is-swipe-ready");
    triggerCompletionHaptic();
    playCelebration();
    window.setTimeout(() => swipeStep.classList.remove("is-swipe-ready"), 950);
  }

  if (!isComplete) {
    hasShownSwipeReadyEffect = false;
    swipeStep.classList.remove("is-swipe-ready");
  }

  return normalized;
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

function getCertificateContent() {
  const name = getDisplayName();
  const label = activeTheme === "morning"
    ? "SHINJUKU MORNING SUPPORTER"
    : isAllExperience
      ? "新宿みんなのアクション証"
    : isMenExperience
      ? "新宿ナイトアクション証"
    : isSparkleExperience
      ? "新宿ときめき参加証"
      : "SHINJUKU COLOR SUPPORTER";

  const description = activeTheme === "morning"
    ? `¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}は、朝の新宿を応援する意思を示すデモ表示です。`
    : isAllExperience
      ? `¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}は、誰もが過ごしやすい新宿を応援する意思を示すデモ表示です。`
    : isMenExperience
      ? `¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}は、夜の新宿を応援する意思を示すデモ表示です。`
    : isSparkleExperience
      ? `¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}は、新宿を応援する意思を示すデモ表示です。`
      : `¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}は、新宿を応援する意思を示すデモ表示です。`;

  return { label, name, description };
}

function buildFinalCard() {
  if (isFinalCardBuilt) {
    return;
  }
  isFinalCardBuilt = true;
  finalCard.replaceChildren();

  const content = getCertificateContent();
  const label = document.createElement("p");
  label.textContent = content.label;

  const name = document.createElement("h3");
  name.textContent = content.name;

  const description = document.createElement("p");
  description.textContent = content.description;

  finalCard.append(label, name, description);
}

function getRandomThanksStory() {
  const index = Math.floor(Math.random() * THANKS_STORIES.length);
  return THANKS_STORIES[index];
}

function hideStoryThanksCard() {
  if (!shouldUseStoryThanksCard) {
    return;
  }

  const wasActive = storyCardOverlay.classList.contains("is-active");
  if (storyCardDismissTimer) {
    window.clearTimeout(storyCardDismissTimer);
    storyCardDismissTimer = null;
  }
  storyCardOverlay.classList.remove("is-active");
  storyCardOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-story-card-open");

  if (wasActive && currentStep === 0 && hasCountedParticipation) {
    nextStep();
  }
}

function scheduleStoryCardDismiss() {
  if (storyCardDismissTimer) {
    window.clearTimeout(storyCardDismissTimer);
  }

  const visibleMs = prefersReducedMotion
    ? STORY_CARD_REDUCED_MOTION_MS
    : STORY_CARD_VISIBLE_MS;
  storyCardDismissTimer = window.setTimeout(() => {
    storyCardDismissTimer = null;
    hideStoryThanksCard();
  }, visibleMs);
}

function showStoryThanksCard() {
  if (!shouldUseStoryThanksCard) {
    return false;
  }

  const story = getRandomThanksStory();
  const storyDescription = isAllExperience && story.descriptionAll
    ? story.descriptionAll
    : isMenExperience && story.descriptionMen
      ? story.descriptionMen
      : story.description;
  storyCardTitle.textContent = story.title;
  storyCardDescription.textContent = storyDescription;
  storyFilm.classList.remove("is-playing");
  storyFilm.dataset.story = story.id;
  void storyFilm.offsetWidth;
  storyFilm.classList.add("is-playing");

  storyCardOverlay.setAttribute("aria-hidden", "false");
  storyCardOverlay.classList.add("is-active");
  document.body.classList.add("is-story-card-open");
  scheduleStoryCardDismiss();

  if (swipeHint) {
    swipeHint.textContent = "ありがとうございます。支援先のストーリーを表示しています。";
  }

  return true;
}

function finalizeCard() {
  isFinalCardBuilt = false;
  buildFinalCard();
  nextStep();
}

async function registerParticipation() {
  if (hasCountedParticipation) {
    return true;
  }
  if (isRegisteringParticipation) {
    return false;
  }
  isRegisteringParticipation = true;

  try {
    const payload = {
      name: getDisplayName(),
      donationAmountYen: DEMO_DONATION_YEN,
    };

    if (isAllExperience) {
      payload.source = "participant-flow-all";
    } else if (isMenExperience) {
      payload.source = "participant-flow-men";
    } else if (isSparkleExperience) {
      payload.source = "participant-flow-women";
    }

    if (PARTICIPATION_CHANNEL !== "default") {
      payload.channel = PARTICIPATION_CHANNEL;
      payload.source = payload.source ?? "participant-flow-morning";
    }

    const result = await publishSwipeComplete(payload);
    const committedCount = Number(result?.count);
    participantCount = Number.isFinite(committedCount)
      ? committedCount
      : participantCount + 1;
    if (counterParticipants) {
      counterParticipants.textContent = participantCount.toLocaleString("ja-JP");
    }
    updateMilestonePreview(participantCount);
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
    if (!showStoryThanksCard()) {
      nextStep();
    }
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
    swipeHint.textContent = "応援アクションを反映しています。";
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

function buildShareUrl() {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function buildShareText() {
  const supporterName = getDisplayName();
  return `新宿で続く取り組みを知り、応援の意思を示しました。\nSHINJUKU SUPPORTER「${supporterName}」として参加。\nあなたも →`;
}

function getStorySharePalette() {
  if (activeTheme === "morning") {
    return {
      bg: "#f8f2e7",
      panel: "#fffdf8",
      ink: "#241a14",
      muted: "#66574d",
      accent: "#cc5f28",
      accentSoft: "rgba(204, 95, 40, 0.18)",
      secondary: "#3f7f87",
      secondarySoft: "rgba(63, 127, 135, 0.16)",
      highlight: "#efb44c",
    };
  }

  if (isAllExperience) {
    return {
      bg: "#f7f8f3",
      panel: "#ffffff",
      ink: "#141816",
      muted: "#3f4c47",
      accent: "#087f73",
      accentSoft: "rgba(8, 127, 115, 0.18)",
      secondary: "#2a8fbc",
      secondarySoft: "rgba(42, 143, 188, 0.16)",
      highlight: "#e7b931",
    };
  }

  if (isMenExperience) {
    return {
      bg: "#101211",
      panel: "#1b1f1d",
      ink: "#f3f5ed",
      muted: "#c7cdc3",
      accent: "#6fefdb",
      accentSoft: "rgba(111, 239, 219, 0.14)",
      secondary: "#5fb6ff",
      secondarySoft: "rgba(95, 182, 255, 0.14)",
      highlight: "#f4b84a",
    };
  }

  if (isSparkleExperience) {
    return {
      bg: "#fff8f0",
      panel: "#fffdf9",
      ink: "#231914",
      muted: "#5a4338",
      accent: "#d85b13",
      accentSoft: "rgba(216, 91, 19, 0.18)",
      secondary: "#417989",
      secondarySoft: "rgba(65, 121, 137, 0.16)",
      highlight: "#f6b238",
    };
  }

  return {
    bg: "#f9f6f1",
    panel: "#ffffff",
    ink: "#1d1d1f",
    muted: "#5c5c61",
    accent: "#ee6b6e",
    accentSoft: "rgba(238, 107, 110, 0.18)",
    secondary: "#156082",
    secondarySoft: "rgba(21, 96, 130, 0.16)",
    highlight: "#e5b95f",
  };
}

function drawPolygon(ctx, points, fillStyle) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, safeRadius);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  const paragraphs = String(text).split("\n");
  let nextY = y;
  let drawnLines = 0;

  for (const paragraph of paragraphs) {
    let line = "";
    const chars = Array.from(paragraph);

    for (const char of chars) {
      const testLine = `${line}${char}`;
      if (line && ctx.measureText(testLine).width > maxWidth) {
        ctx.fillText(line, x, nextY);
        nextY += lineHeight;
        drawnLines += 1;
        if (drawnLines >= maxLines) {
          return nextY;
        }
        line = char.trimStart();
      } else {
        line = testLine;
      }
    }

    if (line || chars.length === 0) {
      ctx.fillText(line, x, nextY);
      nextY += lineHeight;
      drawnLines += 1;
      if (drawnLines >= maxLines) {
        return nextY;
      }
    }
  }

  return nextY;
}

function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Story image export failed."));
      }
    }, type, quality);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function drawStoryShareImage() {
  const palette = getStorySharePalette();
  const content = getCertificateContent();
  const url = buildShareUrl();
  const canvas = document.createElement("canvas");
  canvas.width = STORY_IMAGE_WIDTH;
  canvas.height = STORY_IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, STORY_IMAGE_WIDTH, STORY_IMAGE_HEIGHT);

  drawPolygon(ctx, [[0, 0], [520, 0], [0, 620]], palette.accentSoft);
  drawPolygon(ctx, [[STORY_IMAGE_WIDTH, 0], [STORY_IMAGE_WIDTH, 520], [640, 0]], palette.secondarySoft);
  drawPolygon(ctx, [[0, STORY_IMAGE_HEIGHT], [420, STORY_IMAGE_HEIGHT], [0, 1430]], palette.secondarySoft);
  drawPolygon(
    ctx,
    [[STORY_IMAGE_WIDTH, STORY_IMAGE_HEIGHT], [STORY_IMAGE_WIDTH, 1310], [620, STORY_IMAGE_HEIGHT]],
    palette.accentSoft
  );

  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 4;
  for (let x = -180; x < STORY_IMAGE_WIDTH + 240; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 260);
    ctx.lineTo(x + 340, 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawRoundedRect(ctx, 86, 360, 908, 940, 54);
  ctx.fillStyle = palette.panel;
  ctx.fill();
  ctx.strokeStyle = palette.accentSoft;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = palette.highlight;
  ctx.fillRect(86, 360, 908, 18);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(86, 378, 908, 10);

  ctx.fillStyle = palette.muted;
  ctx.font = "700 34px Quicksand, 'Noto Sans JP', sans-serif";
  ctx.letterSpacing = "0px";
  ctx.fillText("SHINJUKU DOOH PROJECT", 146, 486);

  ctx.fillStyle = palette.accent;
  ctx.font = "700 54px 'Noto Sans JP', sans-serif";
  drawWrappedText(ctx, content.label, 146, 590, 788, 68, 2);

  ctx.fillStyle = palette.ink;
  ctx.font = "700 96px Quicksand, 'Noto Sans JP', sans-serif";
  const nameStartY = 780;
  const nameEndY = drawWrappedText(ctx, content.name, 146, nameStartY, 788, 112, 3);

  ctx.strokeStyle = palette.accentSoft;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(146, nameEndY + 44);
  ctx.lineTo(934, nameEndY + 44);
  ctx.stroke();

  ctx.fillStyle = palette.muted;
  ctx.font = "500 44px 'Noto Sans JP', sans-serif";
  drawWrappedText(ctx, content.description, 146, nameEndY + 132, 788, 66, 5);

  ctx.fillStyle = palette.accent;
  ctx.font = "700 70px Quicksand, 'Noto Sans JP', sans-serif";
  ctx.fillText(`+¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}`, 146, 1216);

  ctx.fillStyle = palette.ink;
  ctx.font = "700 58px 'Noto Sans JP', sans-serif";
  drawWrappedText(ctx, "新宿にやさしい光を届けました", 112, 1460, 856, 74, 2);

  ctx.fillStyle = palette.muted;
  ctx.font = "500 34px Quicksand, 'Noto Sans JP', sans-serif";
  drawWrappedText(ctx, new URL(url).host, 112, 1620, 856, 46, 2);

  return canvas;
}

async function createInstagramStoryImageFile() {
  const canvas = drawStoryShareImage();
  const blob = await canvasToBlob(canvas, "image/png");
  const filename = "shinjuku-dooh-story.png";

  if (typeof File === "function") {
    return new File([blob], filename, { type: "image/png" });
  }

  blob.name = filename;
  return blob;
}

async function writeShareTextToClipboard() {
  const text = `${buildShareText()} ${buildShareUrl()}`;
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  await navigator.clipboard.writeText(text);
  return true;
}

async function copyShareLink() {
  try {
    const didCopy = await writeShareTextToClipboard();
    if (!didCopy) {
      throw new Error("Clipboard API is unavailable.");
    }
    if (shareStatus) {
      shareStatus.textContent = "リンクをコピーしました。";
    }
  } catch {
    if (shareStatus) {
      shareStatus.textContent = `コピーできませんでした。URL: ${buildShareUrl()}`;
    }
  }
}

async function triggerWebShare() {
  const url = buildShareUrl();
  const text = buildShareText();

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Shinjuku DOOH Project",
        text,
        url,
      });
      if (shareStatus) {
        shareStatus.textContent = "シェアありがとうございます。";
      }
      return;
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }
      console.warn("[share] navigator.share failed:", error);
    }
  }
  await copyShareLink();
}

async function shareToInstagramStory() {
  if (shareStatus) {
    shareStatus.textContent = "Instagramストーリー用画像を作成しています。";
  }

  try {
    const file = await createInstagramStoryImageFile();
    const files = [file];
    const shareData = {
      files,
      title: "Shinjuku DOOH Story",
      text: "Instagramストーリー用の参加証画像です。",
    };

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (!navigator.canShare || navigator.canShare({ files }))
    ) {
      await navigator.share(shareData);
      if (shareStatus) {
        shareStatus.textContent = "共有先でInstagramのストーリーズを選択してください。";
      }
      return;
    }

    downloadBlob(file, file.name || "shinjuku-dooh-story.png");
    try {
      await writeShareTextToClipboard();
    } catch {
      /* 保存フォールバックが主目的なので、コピー失敗は表示しない。 */
    }
    if (shareStatus) {
      shareStatus.textContent = "ストーリー用PNGを保存しました。Instagramで画像を選択してください。";
    }
  } catch (error) {
    if (error && error.name === "AbortError") {
      return;
    }
    console.warn("[share] Instagram story share failed:", error);
    if (shareStatus) {
      shareStatus.textContent = "Instagramストーリー用画像を作成できませんでした。";
    }
  }
}

function openShareWindow(url) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (_) {
    location.href = url;
  }
}

function shareToLine() {
  const url = buildShareUrl();
  const text = buildShareText();
  const target = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  openShareWindow(target);
  if (shareStatus) {
    shareStatus.textContent = "LINE のシェア画面を開きました。";
  }
}

function shareToX() {
  const url = buildShareUrl();
  const text = buildShareText();
  const target = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  openShareWindow(target);
  if (shareStatus) {
    shareStatus.textContent = "X のポスト画面を開きました。";
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
    const didRegister = await registerParticipation();
    if (didRegister && showStoryThanksCard()) {
      return false;
    }
    return didRegister;
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

const shareProviders = [
  { buttonId: "shareBtn", handler: triggerWebShare },
  { buttonId: "shareLineBtn", handler: shareToLine },
  { buttonId: "shareXBtn", handler: shareToX },
  { buttonId: "shareCopyBtn", handler: copyShareLink },
];

shareProviders.forEach(({ buttonId, handler }) => {
  const button = document.getElementById(buttonId);
  if (button) {
    button.addEventListener("click", handler);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && storyCardOverlay?.classList.contains("is-active")) {
    hideStoryThanksCard();
  }
});

window.addEventListener("resize", () => {
  setTrackPosition(currentStep);
});

updateSwipeCharge(0);
applyThemeCopy();
showStep(0);
updateMilestonePreview(participantCount);
loadRelightPlaylist();

getParticipantCount({ channel: PARTICIPATION_CHANNEL })
  .then((count) => {
    syncParticipantCount(count, { preserveLocal: hasCountedParticipation });
  })
  .catch((error) => {
    console.warn("[firebase] participant count fetch failed:", error);
  });

subscribeToParticipantCount((count) => {
  syncParticipantCount(count, { preserveLocal: hasCountedParticipation });
}, { channel: PARTICIPATION_CHANNEL }).catch((error) => {
  console.warn("[firebase] participant count subscription failed:", error);
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
  const previewName = document.getElementById("previewName");
  const nicknameInput = document.getElementById("nickname");

  if (eyebrow) {
    eyebrow.textContent = "Morning Shinjuku";
  }
  if (lead) {
    lead.textContent = "通勤前の3秒で参加できる、朝の新宿への応援アクションです。";
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
  if (previewName) {
    previewName.textContent = RANDOM_GUEST_NAME;
  }
  if (nicknameInput) {
    nicknameInput.placeholder = RANDOM_GUEST_NAME;
  }
  setText("swipeTitle", "上にスワイプして応援する");
  setText("swipeHint", "この画面を上にスワイプしてください。");
  setText("thanksTitle", "参加が朝の新宿に反映されました。");
  setText("certificateTitle", "朝の参加証を受け取る");
  setText("shareTitle", "参加証が作成されました。");
}
