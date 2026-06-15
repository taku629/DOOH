import { getDonationMilestoneGoal } from "../src/condition-manager.js";
import { getParticipantCount, publishNameAnnouncement, publishSwipeComplete, subscribeToParticipantCount } from "../src/firebase-bridge.js?v=20260614-daily-1";
import { triggerCompletionHaptic, triggerProgressHaptic } from "../src/haptic.js";
import { isInappropriateName } from "../src/name-filter.js";
import { clearParticipationVisit, getParticipationVisit, saveParticipationVisit } from "../src/returning-participant.mjs?v=20260614-4";
import { clearSavedDisplayName, getSavedDisplayName, saveDisplayName } from "../src/saved-display-name.mjs?v=20260614-2";
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
const shareCopyButton = document.getElementById("shareCopyBtn");
const swipeControl = document.querySelector(".slider-wrap");
const swipeHint = document.getElementById("swipeHint");
const thanksTitle = document.getElementById("thanksTitle");
const viewport = document.getElementById("viewport");
const track = document.getElementById("track");
const app = document.getElementById("app");
const celebration = document.getElementById("celebration");
const swipeStep = steps[0];
const supportChoiceButtons = [...document.querySelectorAll("[data-support-choice]")];
const supportChoiceDetail = document.getElementById("supportChoiceDetail");

// 体験アウトロ（サンクス＋アンケート予告）。men / women のみ存在。
const outroOverlay = document.getElementById("outroOverlay");
const outroCard = document.getElementById("outroCard");
const outroGlyph = document.getElementById("outroGlyph");
const outroTitle = document.getElementById("outroTitle");
const outroDesc = document.getElementById("outroDesc");
const outroAnswerBtn = document.getElementById("outroAnswerBtn");
const outroTimerFill = outroOverlay?.querySelector(".outro-timer i");
const OUTRO_SCENES = [
  { glyph: "shield", title: "夜の歌舞伎町を見守る取り組み", desc: "新宿で続く夜間パトロールを知るきっかけになります。" },
  { glyph: "cleaning_services", title: "街の環境を整える取り組み", desc: "落書き消去など、街の環境を整える活動を知るきっかけになります。" },
  { glyph: "volunteer_activism", title: "若者を支える取り組み", desc: "NPOによる声かけや相談支援を知るきっかけになります。" },
];
let outroStarted = false;
let outroSceneTimer = null;
let swipeCardShown = false;
let swipeCardDone = false;

// チーム比較用トグル：?thanks=svg で旧・手描き線画ストーリーカード、未指定なら新カード（thanks-proto風）
const thanksStyle = new URLSearchParams(location.search).get("thanks");
const returnTestDate = new URLSearchParams(location.search).get("return-test-date");
const participationDateOverride = /^\d{4}-\d{2}-\d{2}$/.test(returnTestDate || "")
  ? returnTestDate
  : undefined;

const totalSteps = steps.length;
const FALLBACK_COUNTER_TARGET = 0;
const activeTheme = resolveTheme({ defaultTheme: "day" });
const participationSearchParams = new URLSearchParams(location.search);
const requestedParticipationChannel = participationSearchParams.get("channel");
const isExplicitTeamTest = participationSearchParams.get("team-test") === "1";
const PARTICIPATION_CHANNEL = requestedParticipationChannel === "research" && isExplicitTeamTest
  ? "research"
  : getChannelForTheme(activeTheme, "default");
const participationStorageOptions = PARTICIPATION_CHANNEL === "research"
  ? {
      storageKey: "shinjuku-dooh-participation-research",
      displayNameStorageKey: "shinjuku-dooh-display-name-research",
    }
  : {
      storageKey: "shinjuku-dooh-participation",
      displayNameStorageKey: "shinjuku-dooh-display-name",
    };
const pendingParticipationVisit = getParticipationVisit({
  today: participationDateOverride,
  storageKey: participationStorageOptions.storageKey,
});
const DEMO_DONATION_YEN = 100;
const PLAYLIST_PATH = new URL("../config/playlist.json", import.meta.url).href;
const SWIPE_CHARGE_DISTANCE_RATIO = 0.34;
const SWIPE_COMPLETE_SNAP_THRESHOLD = 96;
const STORY_CARD_VISIBLE_MS = 2300;
const STORY_CARD_REDUCED_MOTION_MS = 1000;
const STORY_IMAGE_WIDTH = 1080;
const STORY_IMAGE_HEIGHT = 1920;
const COPY_FEEDBACK_VISIBLE_MS = 2600;
const EXTERNAL_BROWSER_GUIDE_SESSION_KEY = "shinjuku-dooh-external-browser-guide-dismissed";

document.documentElement.dataset.theme = activeTheme;
const experience = document.documentElement.dataset.experience || "default";
const isSparkleExperience = experience === "sparkle";
const isMenExperience = experience === "men";
const isAllExperience = experience === "all";
const isStoryExperience = isSparkleExperience || isMenExperience || isAllExperience;

function shouldShowExternalBrowserGuide() {
  const source = participationSearchParams.get("source");
  const userAgent = navigator.userAgent || "";
  const referrer = document.referrer || "";
  const isInsideResearchPreview = window.parent !== window;
  return !isInsideResearchPreview && (source === "slack" || /Slack/i.test(userAgent) || /slack\.com/i.test(referrer));
}

function setupExternalBrowserGuide() {
  let wasDismissed = false;
  try {
    wasDismissed = Boolean(sessionStorage.getItem(EXTERNAL_BROWSER_GUIDE_SESSION_KEY));
  } catch {
    wasDismissed = false;
  }
  if (!shouldShowExternalBrowserGuide() || wasDismissed) {
    return;
  }

  const guide = document.createElement("section");
  guide.className = "external-browser-guide";
  guide.setAttribute("role", "dialog");
  guide.setAttribute("aria-modal", "true");
  guide.setAttribute("aria-labelledby", "externalBrowserGuideTitle");
  guide.innerHTML = `
    <div class="external-browser-guide-card">
      <h2 id="externalBrowserGuideTitle">Slackから開かず、ブラウザから開いてください</h2>
      <p>翌日の参加記録と前回の名前を引き継ぐため、SafariまたはChromeを使用してください。</p>
      <p class="external-browser-guide-note">共有ボタンやメニューから「ブラウザで開く」を選ぶか、下のリンクをコピーしてSafari・Chromeに貼り付けてください。</p>
      <div class="external-browser-guide-actions">
        <button class="primary" type="button" data-copy-external-link>リンクをコピー</button>
        <button class="ghost" type="button" data-dismiss-external-guide>このまま試す</button>
      </div>
    </div>
  `;
  document.body.appendChild(guide);

  const dismiss = () => {
    try {
      sessionStorage.setItem(EXTERNAL_BROWSER_GUIDE_SESSION_KEY, "1");
    } catch {
      /* Storage can be unavailable in some in-app browsers. */
    }
    guide.hidden = true;
  };
  guide.querySelector("[data-dismiss-external-guide]")?.addEventListener("click", dismiss);
  guide.querySelector("[data-copy-external-link]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const url = new URL("https://shinjuku-dooh-rs.web.app/");
    try {
      await navigator.clipboard.writeText(url.href);
      button.textContent = "コピーしました";
    } catch {
      button.textContent = "右上メニューからブラウザで開く";
    }
  });
}

setupExternalBrowserGuide();
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
const SUPPORT_CHOICE_DETAILS = {
  patrol: {
    title: "夜間の見守り活動",
    description: "夜間パトロールや声かけなど、街を見守る活動です。実運用では、実施団体・活動地域・費用の使途を確認できるようにします。",
  },
  graffiti: {
    title: "街の環境整備",
    description: "落書き消去や清掃など、街の環境を整える活動です。実運用では、作業内容・実施主体・活動報告を確認できるようにします。",
  },
  outreach: {
    title: "若者への相談支援",
    description: "若者への声かけや相談窓口につなぐ活動です。実運用では、支援団体・支援内容・寄付金の用途を確認できるようにします。",
  },
};
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
let hasAcceptedParticipation = false;
let hasShownSwipeReadyEffect = false;
let hasAnimatedCounter = false;
let isFinalCardBuilt = false;
let isRegisteringParticipation = false;
let isAutoCompletingSwipe = false;
let swipeChargeValue = 0;
let counterAnimationFrame = null;
let storyCardDismissTimer = null;
let copyFeedbackTimer = null;
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
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  currentStep = index;
  viewport.classList.toggle("is-participation-step", index === 0);
  steps.forEach((step, stepIndex) => {
    const isCurrent = stepIndex === index;
    step.classList.toggle("is-current", isCurrent);
    step.setAttribute("aria-hidden", String(!isCurrent));
  });

  setTrackPosition(index);
  updateProgress(index);
  app.classList.toggle("is-post-participation", index >= 1);
  app.classList.toggle("is-share-ready", index === totalSteps - 1);

  const resetStepScroll = () => {
    viewport.scrollTop = 0;
    if (steps[index]) {
      steps[index].scrollTop = 0;
    }
    window.scrollTo(0, 0);
  };
  resetStepScroll();
  requestAnimationFrame(resetStepScroll);

  // 体験の最終ステップ（参加証/シェア）に到達したら、アンケートフォームへ自動遷移する。
  // 遷移は body[data-post-flow-form] が設定されたフロー（Men/Women）でのみ有効。
  if (index === totalSteps - 1) {
    scheduleFormRedirect();
  }

  if (index === 1 && hasCountedParticipation && !hasAnimatedCounter) {
    hasAnimatedCounter = true;
    const delay = prefersReducedMotion ? 0 : 420;
    if (counterParticipants) {
      counterParticipants.textContent = participantCount.toLocaleString("ja-JP");
    }
    window.setTimeout(() => animateCounter(getDemoDonationTotal()), delay);
  }
}

// ===== 体験終了後のアンケートフォーム遷移 =====
// body に data-post-flow-form="<URL>"（任意で data-post-flow-delay="<ms>"）がある場合のみ、
// 最終ステップ到達から指定秒後にフォームへ遷移する。属性が無いフローでは何もしない。
let formRedirectTimer = null;

function scheduleFormRedirect() {
  if (formRedirectTimer || outroStarted) {
    return;
  }
  // 調査用プレビューでは親画面がDOOH表示後のアンケート遷移を管理する。
  if (window.parent !== window) {
    return;
  }
  const formUrl = (document.body?.dataset?.postFlowForm || "").trim();
  if (!formUrl) {
    return; // URL未設定（対象外フロー）→ 遷移しない
  }

  // 最後はシンプルに「アンケート予告＋今すぐ答えるボタン」を出して遷移（thanks-proto カードはスワイプ直後で出す）。
  // オーバーレイが無いフローでは控えめな予告のあと自動遷移する。
  if (outroOverlay && outroCard) {
    startSurveyOutro(formUrl);
    return;
  }

  const delay = Number(document.body?.dataset?.postFlowDelay) || 5000;
  if (shareStatus) {
    shareStatus.textContent = "まもなくアンケートに移動します…";
    shareStatus.classList.remove("is-error", "is-success");
    shareStatus.classList.add("is-visible", "is-info");
  }
  formRedirectTimer = window.setTimeout(() => {
    window.location.href = formUrl;
  }, delay);
}

function redirectToForm(formUrl) {
  window.clearTimeout(formRedirectTimer);
  window.clearTimeout(outroSceneTimer);
  window.location.href = formUrl;
}

// thanks-proto 風カードの共通開閉
function openOutro(mode) {
  outroOverlay.classList.remove("mode-story", "mode-survey");
  outroOverlay.classList.add(mode === "survey" ? "mode-survey" : "mode-story");
  outroOverlay.setAttribute("aria-hidden", "false");
  outroOverlay.classList.add("is-active");
}
function closeOutro() {
  window.clearTimeout(outroSceneTimer);
  outroOverlay.classList.remove("is-active");
  outroOverlay.setAttribute("aria-hidden", "true");
  outroCard.classList.remove("is-playing");
}

function playOutroScene(index) {
  const scene = OUTRO_SCENES[index];
  if (!scene) {
    return;
  }
  outroCard.classList.remove("is-playing");
  if (outroGlyph) outroGlyph.textContent = scene.glyph;
  if (outroTitle) outroTitle.textContent = scene.title;
  if (outroDesc) outroDesc.textContent = scene.desc;
  void outroCard.offsetWidth; // リフロー強制でアニメ再start
  outroCard.classList.add("is-playing");
}

// 【スワイプ直後】thanks-proto のカードを1つだけ出す（3つからランダムに1シーン）。
// 表示後に完了ステップへ自動進行。タップでも早送り可能。従来のランダム線画ストーリーの置き換え。
function showSwipeStoryCard() {
  // スワイプ中に何度も呼ばれてもカードは一度きり（ランダム1シーンに固定）。
  if (swipeCardShown || swipeCardDone) {
    return true;
  }
  swipeCardShown = true;
  const holdMs = Number(document.body?.dataset?.swipeSceneMs) || 2600;
  openOutro("story");
  const idx = Math.floor(Math.random() * OUTRO_SCENES.length);
  playOutroScene(idx);
  window.clearTimeout(outroSceneTimer);
  outroSceneTimer = window.setTimeout(advanceAfterSwipeCard, holdMs);
  outroOverlay.addEventListener("click", advanceAfterSwipeCard, { once: true });
  return true;
}

function advanceAfterSwipeCard() {
  if (swipeCardDone) {
    return;
  }
  swipeCardDone = true;
  closeOutro();
  if (currentStep === 0 && hasCountedParticipation) {
    nextStep();
  }
}

// 【体験の最後】シンプルな感謝＋アンケート予告＋ボタンを出して、数秒で自動遷移。
function startSurveyOutro(formUrl) {
  if (outroStarted) {
    return;
  }
  outroStarted = true;

  const lead = Number(document.body?.dataset?.postFlowLead) || 1800;
  const autoMs = Number(document.body?.dataset?.postFlowDelay) || 5000;

  if (outroAnswerBtn) {
    outroAnswerBtn.addEventListener("click", () => redirectToForm(formUrl), { once: true });
  }

  window.setTimeout(() => {
    if (outroGlyph) outroGlyph.textContent = "favorite";
    if (outroTitle) outroTitle.textContent = "ありがとうございました";
    if (outroDesc) outroDesc.textContent = "あなたの参加が、新宿に光を重ねました。";
    openOutro("survey");
    void outroCard.offsetWidth;
    outroCard.classList.add("is-playing");

    if (outroTimerFill && !prefersReducedMotion) {
      outroTimerFill.style.transition = `transform ${autoMs}ms linear`;
      requestAnimationFrame(() => {
        outroTimerFill.style.transform = "scaleX(1)";
      });
    }

    formRedirectTimer = window.setTimeout(() => redirectToForm(formUrl), autoMs);
  }, lead);
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
      ? "CERTIFICATE OF SUPPORT"
    : isSparkleExperience
      ? "CERTIFICATE OF SUPPORT"
      : "SHINJUKU COLOR SUPPORTER";

  const description = activeTheme === "morning"
    ? `¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}は、朝の新宿を応援する意思を示すデモ表示です。`
    : isAllExperience
      ? `¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}は、誰もが過ごしやすい新宿を応援する意思を示すデモ表示です。`
    : isMenExperience
      ? `¥${DEMO_DONATION_YEN.toLocaleString("ja-JP")}は、新宿を応援する意思を示すデモ表示です。`
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
  if (isMenExperience || isSparkleExperience) {
    return false;
  }

  // men / women：スワイプ直後は thanks-proto のカードを出す（?thanks=svg のときは旧・手描き線画にする）。
  if (thanksStyle !== "svg" && outroOverlay && outroCard) {
    return showSwipeStoryCard();
  }
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
  if (window.parent !== window) {
    window.parent.postMessage({
      type: "dooh-research-card-complete",
      participantCount,
      hasDisplayName: Boolean(nickname.value.trim()),
      surveyUrl: (document.body?.dataset?.postFlowForm || "").trim(),
    }, location.origin);
  }
}

// 寄付デモ完了後、公開に同意して入力された表示名だけをDOOHへ一度通知する。
let hasAnnouncedName = false;
let completedParticipationVisit = null;
function announceDonorName() {
  if (hasAnnouncedName || !hasAcceptedParticipation) {
    return;
  }

  const typed = nickname.value.trim();
  if (!typed || isInappropriateName(typed)) {
    return;
  }

  saveDisplayName(typed, { storageKey: participationStorageOptions.displayNameStorageKey });
  hasAnnouncedName = true;

  const payload = {
    name: typed,
    channel: PARTICIPATION_CHANNEL,
    visitorId: completedParticipationVisit?.visitorId ?? null,
    isReturning: completedParticipationVisit?.isReturning === true,
    isConsecutiveReturn: completedParticipationVisit?.isConsecutiveReturn === true,
    streakDays: completedParticipationVisit?.streakDays ?? 1,
  };
  if (isAllExperience) {
    payload.source = "participant-flow-all";
  } else if (isMenExperience) {
    payload.source = "participant-flow-men";
  } else if (isSparkleExperience) {
    payload.source = "participant-flow-women";
  }

  publishNameAnnouncement(payload).catch(() => {});
}

function markAlreadyParticipatedToday(visit) {
  completedParticipationVisit = visit;
  hasCountedParticipation = true;
  hasAcceptedParticipation = false;
  hasAnnouncedName = true;
  swipeStep?.classList.add("is-participation-locked");
  swipeControl?.setAttribute("aria-disabled", "true");
  if (swipeHint) {
    swipeHint.textContent = "本日はすでに参加済みです。また明日の参加をお待ちしています。";
  }
  if (thanksTitle) {
    thanksTitle.textContent = "本日は参加済みです";
  }
  if (window.parent !== window) {
    window.parent.postMessage({
      type: "dooh-research-already-participated",
      participantCount,
    }, location.origin);
  }
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
    const visit = getParticipationVisit({
      today: participationDateOverride,
      storageKey: participationStorageOptions.storageKey,
    });
    if (visit.alreadyParticipatedToday) {
      markAlreadyParticipatedToday(visit);
      return true;
    }
    const payload = {
      name: getDisplayName(),
      donationAmountYen: DEMO_DONATION_YEN,
      visitorId: visit.visitorId,
      participationDate: visit.participationDate,
      isReturning: visit.isReturning,
      isConsecutiveReturn: visit.isConsecutiveReturn,
      streakDays: visit.streakDays,
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
    if (result?.failed === true) {
      if (swipeHint) {
        swipeHint.textContent = "通信が混み合っています。接続を確認して、もう一度スワイプしてください。";
      }
      return false;
    }
    if (result?.accepted === false) {
      markAlreadyParticipatedToday(visit);
      return true;
    }
    const committedVisit = {
      ...visit,
      isReturning: result?.event?.isReturning === true,
      isConsecutiveReturn: result?.event?.isConsecutiveReturn === true,
      streakDays: Math.max(1, Number(result?.event?.streakDays) || 1),
    };
    saveParticipationVisit(committedVisit, { storageKey: participationStorageOptions.storageKey });
    completedParticipationVisit = committedVisit;
    const committedCount = Number(result?.count);
    participantCount = Number.isFinite(committedCount)
      ? committedCount
      : participantCount + 1;
    if (counterParticipants) {
      counterParticipants.textContent = participantCount.toLocaleString("ja-JP");
    }
    updateMilestonePreview(participantCount);
    hasCountedParticipation = true;
    hasAcceptedParticipation = true;
    hasAnimatedCounter = false;
    if (window.parent !== window) {
      window.parent.postMessage({
        type: "dooh-research-participation-complete",
        participantCount,
      }, location.origin);
    }
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

  if (isSparkleExperience || isMenExperience) {
    return `SHINJUKU GIVEの応援アクションに参加しました。\n${supporterName}の参加証を共有します。\nあなたも →`;
  }

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
      bg: "#f9f9ff",
      panel: "#ffffff",
      ink: "#151919",
      muted: "#5c5f60",
      accent: "#151919",
      accentSoft: "rgba(21, 25, 25, 0.14)",
      secondary: "#2a313d",
      secondarySoft: "rgba(42, 49, 61, 0.1)",
      highlight: "#c4c7ca",
    };
  }

  if (isSparkleExperience) {
    return {
      bg: "#f9f9ff",
      panel: "#ffffff",
      ink: "#151919",
      muted: "#5c5f60",
      accent: "#151919",
      accentSoft: "rgba(21, 25, 25, 0.14)",
      secondary: "#2a313d",
      secondarySoft: "rgba(42, 49, 61, 0.1)",
      highlight: "#c4c7ca",
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
  const storyProjectLabel = (isSparkleExperience || isMenExperience) ? "SHINJUKU GIVE" : "SHINJUKU DOOH PROJECT";
  ctx.fillText(storyProjectLabel, 146, 486);

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

function setShareStatus(message, tone = "info") {
  if (!shareStatus) {
    return;
  }

  shareStatus.textContent = message;
  shareStatus.classList.remove("is-info", "is-success", "is-error");
  shareStatus.classList.add("is-visible", `is-${tone}`);
}

function showCopyFeedback() {
  if (!shareCopyButton) {
    return;
  }

  if (!shareCopyButton.dataset.defaultLabel) {
    shareCopyButton.dataset.defaultLabel = shareCopyButton.textContent.trim();
  }

  shareCopyButton.textContent = "コピーしました";
  shareCopyButton.classList.add("is-copied");
  shareCopyButton.setAttribute("aria-label", "リンクをコピーしました");

  if (copyFeedbackTimer) {
    window.clearTimeout(copyFeedbackTimer);
  }

  copyFeedbackTimer = window.setTimeout(() => {
    shareCopyButton.textContent = shareCopyButton.dataset.defaultLabel || "リンクをコピー";
    shareCopyButton.classList.remove("is-copied");
    shareCopyButton.setAttribute("aria-label", shareCopyButton.dataset.defaultLabel || "リンクをコピー");
    copyFeedbackTimer = null;
  }, COPY_FEEDBACK_VISIBLE_MS);
}

async function copyShareLink() {
  try {
    const didCopy = await writeShareTextToClipboard();
    if (!didCopy) {
      throw new Error("Clipboard API is unavailable.");
    }
    showCopyFeedback();
    setShareStatus("コピーしました。LINEやXにそのまま貼れます。", "success");
  } catch {
    setShareStatus(`コピーできませんでした。URL: ${buildShareUrl()}`, "error");
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
    return !pendingParticipationVisit.alreadyParticipatedToday && swipeChargeValue >= 100;
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
  swipeControl?.classList.remove("is-pointer-active");
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
  if (pendingParticipationVisit.alreadyParticipatedToday || hasCountedParticipation) {
    return;
  }
  if (currentStep !== 0) {
    return;
  }
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }
  if (isInteractiveTarget(event.target)) {
    return;
  }
  if (!event.target.closest(".slider-wrap")) {
    return;
  }

  activePointerId = event.pointerId;
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  dragOffset = 0;
  dragAxisLocked = null;
  swipeStartValue = swipeChargeValue;
  isChargingSwipe = false;
  if (currentStep === 0) {
    swipeControl?.classList.add("is-pointer-active");
  }

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

// 表示名を参加証プレビューへ即時反映。日本語IMEの変換中(composition)でも更新されるよう
// input だけでなく composition 系イベントも拾う（一部の端末は input が確定まで走らないため）。
const syncPreviewName = () => {
  previewName.textContent = getDisplayName();
};
nickname.addEventListener("input", syncPreviewName);
nickname.addEventListener("compositionupdate", syncPreviewName);
nickname.addEventListener("compositionend", syncPreviewName);

function setupSavedNameChoice() {
  const savedName = getSavedDisplayName({
    storageKey: participationStorageOptions.displayNameStorageKey,
  });
  const nameField = nickname.closest(".sparkle-name-field") ?? nickname;
  const nameStep = nickname.closest(".step");
  if (!savedName || !pendingParticipationVisit.isReturning || !nameStep) {
    return;
  }

  const choice = document.createElement("section");
  choice.className = "saved-name-choice";
  choice.setAttribute("aria-label", "前回の表示名を使用");

  const copy = document.createElement("p");
  copy.innerHTML = `前回の表示名 <strong></strong> を使用しますか？`;
  copy.querySelector("strong").textContent = savedName;

  const actions = document.createElement("div");
  actions.className = "saved-name-actions";
  const reuseButton = document.createElement("button");
  reuseButton.type = "button";
  reuseButton.className = "primary";
  reuseButton.textContent = "この名前を使う";
  const changeButton = document.createElement("button");
  changeButton.type = "button";
  changeButton.className = "ghost";
  changeButton.textContent = "名前を変更";
  actions.append(reuseButton, changeButton);
  choice.append(copy, actions);
  nameStep.insertBefore(choice, nameField);

  reuseButton.addEventListener("click", () => {
    nickname.value = savedName;
    syncPreviewName();
    choice.hidden = true;
  });
  changeButton.addEventListener("click", () => {
    nickname.value = "";
    syncPreviewName();
    choice.hidden = true;
    nickname.focus();
  });
}

setupSavedNameChoice();

document.getElementById("createCard").addEventListener("click", () => {
  announceDonorName();
  finalizeCard();
});
document.getElementById("skipName").addEventListener("click", () => {
  finalizeCard();
});

supportChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const detail = SUPPORT_CHOICE_DETAILS[button.dataset.supportChoice];
    if (!detail || !supportChoiceDetail) {
      return;
    }

    supportChoiceButtons.forEach((option) => {
      option.setAttribute("aria-pressed", String(option === button));
    });
    supportChoiceDetail.replaceChildren();
    const title = document.createElement("h4");
    title.textContent = detail.title;
    const description = document.createElement("p");
    description.textContent = detail.description;
    supportChoiceDetail.append(title, description);
    supportChoiceDetail.hidden = false;
    if (window.parent !== window) {
      window.parent.postMessage({
        type: "dooh-research-support-choice",
        supportChoice: button.dataset.supportChoice,
      }, location.origin);
    }
  });
});

window.addEventListener("message", (event) => {
  if (
    event.origin !== location.origin ||
    event.source !== window.parent ||
    !["dooh-research-open-name-step", "dooh-research-reset-device"].includes(event.data?.type)
  ) {
    return;
  }

  if (event.data.type === "dooh-research-reset-device") {
    clearParticipationVisit({ storageKey: participationStorageOptions.storageKey });
    clearSavedDisplayName({ storageKey: participationStorageOptions.displayNameStorageKey });
    window.parent.postMessage({ type: "dooh-research-device-reset" }, location.origin);
    return;
  }

  showStep(2);
  const nameStep = steps[2];
  if (nameStep) {
    nameStep.scrollTop = 0;
  }
});

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
  { buttonId: "shareInstagramStoryBtn", handler: shareToInstagramStory },
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
if (pendingParticipationVisit.alreadyParticipatedToday) {
  markAlreadyParticipatedToday(pendingParticipationVisit);
}
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
  setText("swipeHint", "");
  setText("thanksTitle", "参加が朝の新宿に反映されました。");
  setText("certificateTitle", "朝の参加証を受け取る");
  setText("shareTitle", "参加証が作成されました。");
}
