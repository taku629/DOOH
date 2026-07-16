import { getDonationMilestoneGoal } from "../src/condition-manager.js";
import { getLatestNameAnnouncementForVisitor, getParticipantCount, getRecentNameAnnouncements, getSupporterComments, publishNameAnnouncement, publishSupporterComment, publishSwipeComplete, subscribeToNameAnnouncements, subscribeToParticipantCount } from "../src/firebase-bridge.js?v=20260715-name-feed-race-1";
import { logAnalyticsEvent } from "../src/analytics-bridge.js?v=20260626-youtube-analytics-1";
import { triggerCompletionHaptic, triggerProgressHaptic } from "../src/haptic.js";
import { isInappropriateName } from "../src/name-filter.js";
import { moderateDisplayName } from "../src/name-moderation.js?v=20260619-ai-1";
import { getDemoSupporterPasscodes, verifySupporterPasscode } from "../src/supporter-passcodes.js?v=20260623-demo-code-1";
import { clearParticipationVisit, getParticipationVisit, saveParticipationVisit } from "../src/returning-participant.mjs?v=20260614-4";
import { clearSavedDisplayName, getSavedDisplayName, saveDisplayName } from "../src/saved-display-name.mjs?v=20260614-2";
import { getChannelForTheme, resolveTheme } from "../src/theme-router.js";
import { renderInkLocationMap, setInkLocationStatus } from "./ink-location-map.js?v=20260716-v1-2";
import { mountDoohGazePrompt } from "./dooh-gaze-prompt.js?v=20260716-v1-2";

const steps = [...document.querySelectorAll(".step")];
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const progressElement = document.querySelector(".bar");
const stepBackButton = document.getElementById("stepBack");
const counterValue = document.getElementById("counterValue");
const counterBox = document.getElementById("counterBox");
const counterParticipants = document.getElementById("counterParticipants");
const counterLabel = counterBox?.firstElementChild;
const counterUnit = counterBox?.querySelector(".unit");
const counterBadge = counterBox?.querySelector("em");
const counterDetail = counterParticipants?.closest("small") || counterBox?.querySelector("small");
const nickname = document.getElementById("nickname");
const nicknameHelp = document.getElementById("nicknameHelp");
const inkLocationCard = document.getElementById("inkLocationCard");
const nicknameLabel = document.querySelector("label[for='nickname']");
const nicknameField = nickname?.closest(".sparkle-name-field");
const tickerFontPicker = document.querySelector(".ticker-font-picker");
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
const createCardButton = document.getElementById("createCard");
const skipNameButton = document.getElementById("skipName");
const supporterPasscode = document.getElementById("supporterPasscode");
const supporterComment = document.getElementById("supporterComment");
const supporterCommentHelp = document.getElementById("supporterCommentHelp");
const tickerFontButtons = [...document.querySelectorAll("[data-ticker-font]")];
const defaultNicknameHelpText = nicknameHelp?.textContent ?? "";
const defaultSupporterCommentHelpText = supporterCommentHelp?.textContent ?? "";
const sectionJumpNav = document.getElementById("sectionJumpNav");
const sectionJumpToggle = document.getElementById("sectionJumpToggle");
const sectionJumpMenu = document.getElementById("sectionJumpMenu");
const sectionJumpButtons = [...document.querySelectorAll("[data-jump-target]")];
const isSupporterFlow = document.body?.dataset.flowMode === "supporter";

// Location confirmation and naming are one action; keep optional details below them.
if (inkLocationCard && nicknameLabel && nicknameField && nicknameHelp && tickerFontPicker && createCardButton && skipNameButton) {
  inkLocationCard.append(nicknameLabel, nicknameField, nicknameHelp, tickerFontPicker, createCardButton.closest(".actions"));
}

function syncVisibleViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--visible-viewport-height", `${Math.round(height)}px`);
}

syncVisibleViewportHeight();
window.visualViewport?.addEventListener("resize", syncVisibleViewportHeight, { passive: true });
window.addEventListener("orientationchange", syncVisibleViewportHeight, { passive: true });

const certificateStep = steps[2];
const certificateActions = certificateStep?.querySelector(":scope > .actions");
const thanksStep = steps[1];
const thanksActionPortal = thanksStep?.querySelector(":scope > .thanks-actions");
const thanksPrimaryAction = thanksActionPortal?.querySelector(":scope > .primary");
const thanksFastTrackAction = document.getElementById("supporterFastTrack");
const doohGazePrompt = mountDoohGazePrompt(thanksStep, { language: "ja" });

const supportDetailsDisclosure = (() => {
  const supportChoice = document.querySelector(".support-choice");
  const supportTrend = document.querySelector(".support-trend");
  if (!tickerFontPicker || !supportChoice || !supportTrend) return null;
  const details = document.createElement("details");
  details.className = "support-details-disclosure";
  const summary = document.createElement("summary");
  summary.innerHTML = '<span data-support-summary></span><strong data-support-details-open></strong>';
  details.append(summary, supportChoice, supportTrend);
  inkLocationCard.after(details);
  if (!isSupporterFlow && certificateActions) details.after(certificateActions);
  return details;
})();

function syncMobileCertificateActions(stepIndex = currentStep) {
  const isMobile = window.matchMedia("(max-width: 480px)").matches;
  const shouldPortalThanks = stepIndex === 1 && isMobile;
  if (thanksStep && thanksActionPortal && shouldPortalThanks && thanksActionPortal.parentElement !== document.body) {
    thanksActionPortal.classList.add("is-mobile");
    document.body.append(thanksActionPortal);
  } else if (thanksStep && thanksActionPortal && !shouldPortalThanks && thanksActionPortal.parentElement === document.body) {
    thanksActionPortal.classList.remove("is-mobile");
    thanksStep.append(thanksActionPortal);
  }

  if (!certificateStep || !certificateActions) {
    return;
  }
  const shouldPortal = stepIndex === 2 && isMobile;
  if (shouldPortal && certificateActions.parentElement !== document.body) {
    certificateActions.classList.add("is-mobile-action-portal");
    document.body.append(certificateActions);
  } else if (!shouldPortal && certificateActions.parentElement === document.body) {
    certificateActions.classList.remove("is-mobile-action-portal");
    if (supportDetailsDisclosure?.isConnected) supportDetailsDisclosure.after(certificateActions);
    else certificateStep.append(certificateActions);
  }
}

window.addEventListener("resize", () => syncMobileCertificateActions(), { passive: true });

thanksFastTrackAction?.addEventListener("click", () => {
  // 通常ページ(standard)ではクラファン入力を持たないので、支援者ページへ遷移する。
  // スワイプ(募金)は済んでいるため、遷移先では entry=swiped でスワイプを再要求しない。
  if (document.body.dataset.flowMode === "standard") {
    const params = new URLSearchParams(window.location.search);
    params.set("entry", "swiped");
    const dest = window.location.pathname.includes("participant-flow-shared.html")
      ? window.location.pathname.replace("participant-flow-shared.html", "participant-flow-supporter.html")
      : (isMenExperience ? "/supporter/men" : "/supporter/women");
    window.location.href = `${dest}?${params.toString()}`;
    return;
  }
  setSupporterCertificateIntent(true);
  showStep(2);
  requestAnimationFrame(() => requestAnimationFrame(() => jumpToCertificateSection("supporterCommentEntry")));
});

thanksPrimaryAction?.addEventListener("click", () => setSupporterCertificateIntent(false));

let supporterCertificateIntent = false;

function setSupporterCertificateIntent(isSupporter) {
  supporterCertificateIntent = isSupporter;
  document.body.classList.toggle("is-supporter-certificate-intent", isSupporter);
  if (createCardButton) {
    createCardButton.textContent = isEnglish() ? "Send this name" : "この名前を送る";
  }
  if (skipNameButton) {
    skipNameButton.textContent = isEnglish() ? "Leave it unnamed" : "このまま見守る";
  }
}

[supporterPasscode, supporterComment].forEach((field) => {
  field?.addEventListener("input", () => {
    setSupporterCertificateIntent(Boolean(supporterPasscode?.value.trim() || supporterComment?.value.trim()));
  });
});

function setSectionJumpMenuOpen(isOpen) {
  if (!sectionJumpToggle || !sectionJumpMenu) {
    return;
  }
  sectionJumpToggle.setAttribute("aria-expanded", String(isOpen));
  sectionJumpMenu.hidden = !isOpen;
  sectionJumpNav?.classList.toggle("is-open", isOpen);
}

function jumpToCertificateSection(targetId) {
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }
  const scrollTarget = targetId === "nickname"
    ? document.querySelector('label[for="nickname"]') || target
    : target;
  setSectionJumpMenuOpen(false);
  // #viewport は color-flow の装飾のため overflow:hidden。scrollIntoView だと
  // この要素までスクロールされ、ユーザーが指やホイールで上に戻せなくなる。
  // 内側は常に0へ戻し、移動はページ(window)スクロールだけで行う。
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const margin = parseFloat(getComputedStyle(scrollTarget).scrollMarginTop) || 0;
  viewport.scrollTop = 0;
  const currentStepEl = steps[currentStep];
  if (currentStepEl) {
    currentStepEl.scrollTop = 0;
  }
  const docTop = scrollTarget.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: Math.max(0, docTop - margin), behavior });
  if (target.matches("input, textarea, button")) {
    window.setTimeout(() => target.focus({ preventScroll: true }), 360);
  }
}

sectionJumpToggle?.addEventListener("click", () => {
  setSectionJumpMenuOpen(sectionJumpToggle.getAttribute("aria-expanded") !== "true");
});

sectionJumpButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.jumpTarget === "supporterCommentEntry") {
      setSupporterCertificateIntent(true);
    }
    // nickname ジャンプは単なる移動。ここで intent を false に戻すと、
    // クラファンページで名前入力へ移動しただけで通常参加証に落ちてしまう。
    jumpToCertificateSection(button.dataset.jumpTarget);
  });
});

document.addEventListener("click", (event) => {
  if (sectionJumpNav && !sectionJumpNav.hidden && !sectionJumpNav.contains(event.target)) {
    setSectionJumpMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setSectionJumpMenuOpen(false);
    sectionJumpToggle?.focus({ preventScroll: true });
  }
});

const jumpSectionIds = ["supportChoiceSection", "nickname", "supporterCommentEntry", "certificatePreview"];
if (typeof IntersectionObserver === "function") {
  const jumpSectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) {
      return;
    }
    sectionJumpMenu?.querySelectorAll("[data-jump-target]").forEach((button) => {
      button.classList.toggle("is-current", button.dataset.jumpTarget === visible.target.id);
    });
  }, { rootMargin: "-18% 0px -62% 0px", threshold: [0.01, 0.2, 0.5] });
  jumpSectionIds.forEach((id) => {
    const target = document.getElementById(id);
    if (target) jumpSectionObserver.observe(target);
  });
}

// パスコード認証を通ったクラファン支援者だけ、参加証と発行演出が別物になる。
let isFoundingSupporter = false;
let foundingSupporterSerial = "";
let foundingSupporterComment = "";
let isCreatingSupporterVideo = false;
const CEREMONY_SPARK_COUNT = 26;
const CEREMONY_RAY_COUNT = 10;
// 演出が終わるまでアンケート遷移も debug リセットも走らせない。
let isCeremonyPlaying = false;
// 支援者は参加証をじっくり眺めたいので、アウトロが被さるまでの間を長く取る。
const SUPPORTER_OUTRO_EXTRA_LEAD_MS = 3200;
// debug 時に最初の画面へ戻すまでの猶予。文言や参加証を確認できる長さにする。
const DEBUG_REPLAY_RESET_MS = 15000;
// 窓の明かりに与える色。「彩＝人」の配色をそのまま持ち込む。
const CERTIFICATE_CITY_COLORS = [
  "#ff5f6d", "#ffc371", "#f9f871", "#7bed9f",
  "#4dd4ff", "#7d8cff", "#c084fc", "#ff8fd0",
];

const NAME_CHECKING_MESSAGE = "\u8868\u793a\u540d\u3092\u78ba\u8a8d\u3057\u3066\u3044\u307e\u3059...";
const NAME_BLOCKED_MESSAGE = "\u3053\u306e\u8868\u793a\u540d\u306f\u516c\u958b\u3067\u304d\u307e\u305b\u3093\u3002\u5225\u306e\u30cb\u30c3\u30af\u30cd\u30fc\u30e0\u306b\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
const NAME_LINKED_MESSAGE = "同じインクに名前を追加しました。";
const NAME_LINK_FAILED_MESSAGE = "DOOHへの名前反映に失敗しました。通信を確認して、もう一度お試しください。";
const SUPPORTER_CHECKING_MESSAGE = "\u30af\u30e9\u30d5\u30a1\u30f3\u652f\u63f4\u8005\u30b3\u30e1\u30f3\u30c8\u3092\u78ba\u8a8d\u3057\u3066\u3044\u307e\u3059...";
const SUPPORTER_PASSCODE_ERROR = "4\u6841\u306e\u30d1\u30b9\u30b3\u30fc\u30c9\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
const SUPPORTER_COMMENT_ERROR = "\u3053\u306e\u30b3\u30e1\u30f3\u30c8\u306f\u8868\u793a\u3067\u304d\u307e\u305b\u3093\u3002\u8868\u73fe\u3092\u5909\u3048\u3066\u304f\u3060\u3055\u3044\u3002";
const SUPPORTER_COMMENT_SAVED = "\u30b3\u30e1\u30f3\u30c8\u3092\u78ba\u8a8d\u3057\u307e\u3057\u305f\u3002\u53c2\u52a0\u8a3c\u3092\u4f5c\u6210\u3067\u304d\u307e\u3059\u3002";
const SUPPORTER_DEMO_CODE_CHECKING = "\u672a\u4f7f\u7528\u306e\u30c7\u30e2\u7528\u30b3\u30fc\u30c9\u3092\u63a2\u3057\u3066\u3044\u307e\u3059...";
const SUPPORTER_DEMO_CODE_READY = "\u30c7\u30e2\u7528\u30b3\u30fc\u30c9\u3092\u81ea\u52d5\u5165\u529b\u3057\u307e\u3057\u305f\u3002\u4e00\u8a00\u30b3\u30e1\u30f3\u30c8\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
const SUPPORTER_DEMO_CODE_FULL = "\u30c7\u30e2\u7528\u30b3\u30fc\u30c9\u304c\u3059\u3079\u3066\u4f7f\u7528\u6e08\u307f\u306e\u305f\u3081\u3001\u5225\u306e\u30b3\u30fc\u30c9\u3092\u81ea\u52d5\u5165\u529b\u3057\u307e\u3057\u305f\u3002";

// 体験アウトロ（サンクス＋アンケート予告）。men / women のみ存在。
const outroOverlay = document.getElementById("outroOverlay");
const outroCard = document.getElementById("outroCard");
const outroGlyph = document.getElementById("outroGlyph");
const outroTitle = document.getElementById("outroTitle");
const outroDesc = document.getElementById("outroDesc");
const outroAnswerBtn = document.getElementById("outroAnswerBtn");
const outroTimerFill = outroOverlay?.querySelector(".outro-timer i");
const OUTRO_SCENES = [
  { glyph: "shield", title: "新宿の再編", desc: "新宿グランドターミナルに向けた再編を知るきっかけになります。" },
  { glyph: "cleaning_services", title: "歩きやすい街へ", desc: "人が憩い、楽しく歩ける都市空間を知るきっかけになります。" },
  { glyph: "volunteer_activism", title: "地域活性化", desc: "歌舞伎町の文化と賑わいを育てる取り組みを知るきっかけになります。" },
];
const OUTRO_SCENES_EN = [
  { glyph: "shield", title: "Shinjuku Redevelopment", desc: "A quick look at the Shinjuku Grand Terminal redevelopment project." },
  { glyph: "cleaning_services", title: "A More Walkable City", desc: "A quick look at streets and public spaces designed for walking and gathering." },
  { glyph: "volunteer_activism", title: "Local Vitality", desc: "A quick look at cultural and community initiatives around Kabukicho." },
];
let outroStarted = false;
let outroSceneTimer = null;
let swipeCardShown = false;
let swipeCardDone = false;
let hasTrackedYouTubeSwipeStart = false;

function setSupportColor(choiceId = null) {
  const normalized = SUPPORT_CHOICE_DETAILS[choiceId] ? choiceId : "";
  if (normalized) {
    app.dataset.supportColor = normalized;
    document.body.dataset.supportColor = normalized;
    return;
  }
  delete app.dataset.supportColor;
  delete document.body.dataset.supportColor;
}

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
const PARTICIPATION_MODE = participationSearchParams.get("mode");
const isYouTubeParticipation = PARTICIPATION_MODE === "youtube";
const requiresSupportChoice = !isYouTubeParticipation;
const YOUTUBE_PARTICIPATION_COOLDOWN_MS = 10 * 1000;
const YOUTUBE_PARTICIPATION_STORAGE_KEY = "shinjuku-dooh-participation-youtube";
const TOTAL_PARTICIPANT_GOAL = 3000;
const VISUAL_CHANGE_INTERVAL = 18;
const requestedParticipationChannel = participationSearchParams.get("channel");
const isExplicitTeamTest = participationSearchParams.get("team-test") === "1";
const PARTICIPATION_CHANNEL = isYouTubeParticipation
  ? "youtube"
  : requestedParticipationChannel === "research" && isExplicitTeamTest
    ? "research"
    : getChannelForTheme(activeTheme, "default");
const participationStorageOptions = PARTICIPATION_CHANNEL === "youtube"
  ? {
      storageKey: YOUTUBE_PARTICIPATION_STORAGE_KEY,
      displayNameStorageKey: "shinjuku-dooh-display-name-youtube",
    }
  : PARTICIPATION_CHANNEL === "research"
  ? {
      storageKey: "shinjuku-dooh-participation-research",
      displayNameStorageKey: "shinjuku-dooh-display-name-research",
    }
  : {
      storageKey: "shinjuku-dooh-participation",
      displayNameStorageKey: "shinjuku-dooh-display-name",
    };
const TICKER_FONT_IDS = new Set(["noto", "rounded", "mincho", "dot", "yusei"]);
const tickerFontStorageKey = `shinjuku-dooh-ticker-font-${PARTICIPATION_CHANNEL}`;
const swipeLinkSessionKey = `shinjuku-dooh-swipe-link-${PARTICIPATION_CHANNEL}`;
function rememberSwipeLink(eventId, count) {
  const normalizedId = String(eventId ?? "").trim();
  const normalizedCount = Math.floor(Number(count));
  if (!normalizedId || !Number.isFinite(normalizedCount) || normalizedCount <= 0) return;
  try {
    sessionStorage.setItem(swipeLinkSessionKey, JSON.stringify({
      eventId: normalizedId,
      count: normalizedCount,
      savedAt: Date.now(),
    }));
  } catch {}
}
function restoreSwipeLink() {
  try {
    const value = JSON.parse(sessionStorage.getItem(swipeLinkSessionKey) || "null");
    if (!value || Date.now() - Number(value.savedAt) > 30 * 60 * 1000) return null;
    const eventId = String(value.eventId ?? "").trim();
    const count = Math.floor(Number(value.count));
    return eventId && Number.isFinite(count) && count > 0 ? { eventId, count } : null;
  } catch {
    return null;
  }
}
const pendingParticipationVisit = getParticipationVisit({
  today: participationDateOverride,
  storageKey: participationStorageOptions.storageKey,
});
// ===== debug（host/ローカルで文言調整するための繰り返しスワイプ） =====
// ?dev / ?debug を付けたとき、または localhost / file:// で開いたとき（＝自分のホストで
// 確認しているとき）は「1回きり」ロックを外し、何度でもスワイプを試せるようにする。
const isLocalHost =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname) ||
  location.protocol === "file:";
const isDebugReplay =
  participationSearchParams.has("dev") ||
  participationSearchParams.has("debug") ||
  isLocalHost;
// 統合デモは本番DBへ書き込むが、端末の「1日1回」ロックは適用しない。
const isLiveShowcaseDemo = participationSearchParams.has("demo-showcase") && !isDebugReplay;
const SHOWCASE_DEMO_NAMES = [
  "さくら", "ゆうと", "あかり", "ケンタ", "みなみ", "はる", "タクミ", "あおい",
  "ひろと", "りん", "まこと", "こはる", "そうた", "めい", "なお", "ひなた",
];

const DEMO_DONATION_YEN = 100;
const MONTHLY_PARTICIPANT_GOAL = 3000;
const PLAYLIST_PATH = new URL("../config/playlist.json", import.meta.url).href;
const SWIPE_CHARGE_DISTANCE_RATIO = 0.34;
const SWIPE_COMPLETE_SNAP_THRESHOLD = 96;
const STORY_CARD_VISIBLE_MS = 2300;
const STORY_CARD_REDUCED_MOTION_MS = 1000;
const STORY_IMAGE_WIDTH = 1080;
const STORY_IMAGE_HEIGHT = 1920;
const SUPPORTER_VIDEO_WIDTH = 1080;
const SUPPORTER_VIDEO_HEIGHT = 1920;
const SUPPORTER_VIDEO_DURATION_MS = 8000;
const SUPPORTER_CEREMONY_IMAGE_URL = new URL("../assets/effects/supporter-color-ceremony-v2.png", import.meta.url).href;
const SUPPORTER_SIGNATURE_IMAGE_URL = new URL("../assets/effects/supporter-keepsake-city-v3.png", import.meta.url).href;
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
      button.textContent = "メニューや共有ボタンからブラウザで開く";
    }
  });
}

setupExternalBrowserGuide();

const LANGUAGE_STORAGE_KEY = "shinjuku-dooh-language";

function normalizeLanguage(value) {
  return String(value || "").toLowerCase() === "en" ? "en" : "ja";
}

function getInitialLanguage() {
  const requestedLanguage = new URLSearchParams(location.search).get("lang");
  if (requestedLanguage) {
    return normalizeLanguage(requestedLanguage);
  }
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return "ja";
  }
}

let currentLanguage = getInitialLanguage();

function isEnglish() {
  return currentLanguage === "en";
}

function buildAboutUrl() {
  const isLocalPreview = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  const url = new URL(isLocalPreview ? "/about.html" : "/about", location.origin);
  url.searchParams.set("from", `${location.pathname}${location.search}${location.hash}`);
  if (isEnglish()) {
    url.searchParams.set("lang", "en");
  }
  return url.toString();
}

function setupAboutLinks() {
  const aboutUrl = buildAboutUrl();
  document.querySelectorAll("[data-about-link]").forEach((link) => {
    link.setAttribute("href", aboutUrl);
  });
}

setupAboutLinks();

const THANKS_STORIES = [
  {
    id: "patrol",
    title: "新宿の再編を知る",
    description: "新宿グランドターミナルに向けた再編の取り組みを知り、応援する意思を示しました。",
    descriptionMen: "新宿グランドターミナルに向けた再編の取り組みを知り、応援する意思を示しました。",
    descriptionAll: "新宿グランドターミナルに向けた再編の取り組みを知り、応援する意思を示しました。",
  },
  {
    id: "graffiti",
    title: "歩きやすい街へ",
    description: "人が憩い、楽しく歩ける都市空間を目指す取り組みを知り、応援する意思を示しました。",
  },
  {
    id: "outreach",
    title: "地域活性化を知る",
    description: "歌舞伎町の文化と賑わいを育てる取り組みを知り、応援する意思を示しました。",
  },
];
const SUPPORT_CHOICE_DETAILS = {
  patrol: {
    title: "新宿の再編",
    description: "新宿駅周辺をつなぐ再整備の取り組みです。",
    linkLabel: "新宿駅直近地区の取り組みを見る",
    url: "https://www.city.shinjuku.lg.jp/kusei/toshikei01_000001_00018.html",
  },
  graffiti: {
    title: "歩きやすい街へ",
    description: "歩いて楽しめる西新宿を目指す取り組みです。",
    linkLabel: "西新宿地区の取り組みを見る",
    url: "https://www.city.shinjuku.lg.jp/kusei/toshikei01_000001_00048.html",
  },
  outreach: {
    title: "地域活性化",
    description: "歌舞伎町の文化と賑わいを育てる取り組みです。",
    linkLabel: "歌舞伎町ルネッサンスを見る",
    url: "https://www.city.shinjuku.lg.jp/kusei/tokumei01_001037.html",
  },
};

const SUPPORT_CHOICE_TRANSLATIONS = {
  ja: SUPPORT_CHOICE_DETAILS,
  en: {
    patrol: {
      title: "Shinjuku Redevelopment",
      description: "Learn about the Shinjuku Grand Terminal project, which connects the station, station plaza, and surrounding buildings.",
      linkLabel: "View the station-area project",
      url: SUPPORT_CHOICE_DETAILS.patrol.url,
    },
    graffiti: {
      title: "A More Walkable City",
      description: "Learn about the Nishi-Shinjuku project for streets and public spaces that are easier and more enjoyable to walk through.",
      linkLabel: "View the Nishi-Shinjuku project",
      url: SUPPORT_CHOICE_DETAILS.graffiti.url,
    },
    outreach: {
      title: "Local Vitality",
      description: "Learn about Kabukicho Renaissance, an initiative that supports local culture, activity, and vibrancy.",
      linkLabel: "View Kabukicho Renaissance",
      url: SUPPORT_CHOICE_DETAILS.outreach.url,
    },
  },
};

const UI_TEXT = {
  ja: {
    pageTitle: "新宿DOOH 参加体験",
    about: "この企画について",
    back: "前の画面へ",
    progressLabels: ["応援", "感謝", "取組", "参加証"],
    eyebrow: "Donation Action",
    campaignTitle: "新宿DOOH",
    lead: "白と黒のコントラストで、静かに参加を届けるデモ体験です。",
    swipeTitle: "新宿を<br />応援しよう",
    fundingNote: "日本中からの協賛金を、<br />あなたのスワイプで支援先へ届けます。",
    donationLabel: "参加者の負担",
    free: "無料",
    swipeInstruction: "指のエリアを上にスワイプしてください。",
    thanksTitle: "ありがとうございます！",
    thanksBody: "あなたの参加で、新宿に静かな光が重なりました。",
    certificateTitle: "参加証に名前を残す",
    supportKicker: "何に使われているの？",
    supportTitle: "応援先を選ぶ（任意）",
    supportLead: "",
    supportAria: "応援したい取り組み",
    detail: "詳しく見る",
    supportNote: "※このデモでは寄付は実行されません。",
    trendKicker: "新宿の治安のいま",
    trendTitle: "犯罪件数は減少傾向",
    trendBody: "",
    trendStat: "",
    trendNote: "出典：警視庁公開データ",
    displayNameLabel: "表示名（任意）",
    nameTab: "ここに入力",
    nicknamePlaceholder: "例：さくら",
    nicknameHelp: "名前を追加すると、同じインクが光ります。参加証・名前ロールにも表示されます。",
    inkLocationTitle: "着弾しました。この彩は、まだ名無しです",
    inkLocationMessage: "この名前が大画面に表示されます。",
    nameLookUpTitle: "名前を受け付けました",
    nameLookUpBody: "大画面に注目してください。",
    nameLookUpClose: "参加証を見る",
    nameQuietTitle: "ご参加ありがとうございました",
    nameQuietBody: "参加証は完成しています。",
    namePublishError: "インクが届きませんでした。もう一度お試しください。",
    supportSummary: "あなたのスワイプは、新宿の再編・歩きやすい街・地域活性化を応援します",
    supportDetailsOpen: "応援先を詳しく見る",
    rankingTitle: "参加者ランキング",
    rankingKicker: "通算参加日数の多い順",
    rankingOpen: "参加者ランキングを見る",
    rankingClose: "ランキングを閉じる",
    rankingDays: "{days}日",
    rankingSelfNote: "あなたは{rank}位です。",
    rankingAnonymousNote: "名前を入力するとランキングに載ります。",
    rankingEmpty: "まだランキングを作れるほど参加がありません。",
    fontLegend: "名前の見た目を選ぶ",
    fontHelp: "",
    supporterKicker: "クラファン支援者の方へ",
    supporterTitle: "DOOHに一言コメントを表示",
    supporterLead: "パスコードと一言を入力",
    passcode: "パスコード",
    comment: "一言コメント",
    commentPlaceholder: "例：新宿が、誰かの居場所であり続けますように",
    supporterHelp: "支援時の4桁を入力。URL・個人情報は書けません。",
    createCard: "この名前を送る",
    skipName: "このまま見守る",
    shareTitle: "参加証が届きました。",
    share: "シェアする",
    shareLine: "LINEで送る",
    shareX: "Xにポスト",
    copyLink: "リンクをコピー",
    counterLabel: "現在の参加人数",
    counterUnit: "人",
    counterGoal: "目標 {goal}人",
    counterRemaining: "あと{remaining}人で達成",
    counterReached: "{goal}人達成しました",
    milestoneKicker: "3000人の彩プロジェクト",
    milestoneShifted: "新宿の映像が切り替わります",
    milestonePrimary: "次の映像変化まであと{remaining}人",
    milestoneSecondary: "累計 {count}人 / 目標 {goal}人",
    milestoneSecondaryReached: "累計 {count}人 / 目標 {goal}人",
    detailAfterCard: "参加証を作成すると、この取り組みの新宿区公式ページを開けます。",
    projectNoteLabel: "デモについて",
    projectNoteText: "現在は授業制作のプロトタイプです。実際の決済や寄付は発生しません。",
    projectNoteLink: "この企画について確認する",
    dataLabel: "出典を確認",
    dataTitle: "新宿区の刑法犯認知件数",
    dataLink: "警視庁の公開データを見る ↗",
    externalNote: "公式ページは別画面で開きます。",
    more: "もっと知る",
    surveyThanks: "ありがとうございました",
    surveyDesc: "あなたの参加が、新宿に光を重ねました。",
    surveyNote: "ご参加ありがとうございました。\nこの後、アンケートにご協力ください。",
    answerNow: "今すぐ答える",
    autoMove: "まもなく自動で移動します…",
    youtubeEyebrow: "YouTube Live",
    youtubeTitle: "応援アクションを<br><span class=\"no-break\">送る</span>",
    youtubeLead: "QRを読み取ってスワイプすると、ライブ中のDOOH画面に匿名で反映されます。",
    youtubeCopy: "この操作は無料です。名前やコメントは表示されません。",
    youtubeSwipe: "指のエリアを上にスワイプしてください。",
    youtubeDoneTitle: "送信しました",
    youtubeDoneCopy: "応援アクションがDOOH画面に反映されます。ライブ画面をご確認ください。",
    youtubeDoneHint: "DOOH画面をご確認ください。約{remaining}後にもう一度参加できます。",
    youtubeLockedTitle: "すでに<br><span class=\"no-break\">送信済みです</span>",
    youtubeLockedCopy: "次の応援アクションは約{remaining}後に送れます。",
    youtubeLockedHint: "送信済みです。約{remaining}後にもう一度参加できます。",
    sendFailed: "参加は1日1回までです。また明日の参加をお待ちしています。",
    sending: "応援アクションを反映しています。",
    busy: "通信が混み合っています。少し時間をおいてもう一度お試しください。",
    alreadyHint: "本日はすでに参加済みです。また明日の参加をお待ちしています。",
    alreadyTitle: "本日は参加済みです",
    certificateLabelAll: "新宿みんなのアクション証",
    certificateLabelDefault: "SHINJUKU COLOR SUPPORTER",
    certificateDescMorning: "この参加は無料です。集まったお金から、朝の新宿を応援する支援先へ¥{amount}を届けます。",
    certificateDescAll: "この参加は無料です。集まったお金から、誰もが過ごしやすい新宿を支える支援先へ¥{amount}を届けます。",
    certificateDescDefault: "この参加は無料です。集まったお金から、新宿を応援する支援先へ¥{amount}を届けます。",
    certificateLabelSupporter: "FOUNDING SUPPORTER",
    certificateDescSupporter: "応援コメントはDOOHに表示されます。",
    certificateSerial: "SERIAL No.{serial}",
    storyThanks: "ありがとうございます。支援先のストーリーを表示しています。",
  },
  en: {
    pageTitle: "Shinjuku DOOH Experience",
    about: "About",
    back: "Back",
    progressLabels: ["Support", "Thanks", "Action", "Certificate"],
    eyebrow: "Donation Action",
    campaignTitle: "SHINJUKU DOOH",
    lead: "A web prototype where your swipe visualizes support for Shinjuku.",
    swipeTitle: "Support<br />Shinjuku",
    fundingNote: "Your free swipe turns sponsored funds from across Japan into support for Shinjuku.",
    donationLabel: "Your cost",
    free: "Free",
    swipeInstruction: "Swipe up inside the finger area.",
    thanksTitle: "Thank you!",
    thanksBody: "Your action added another light to Shinjuku.",
    certificateTitle: "Create your supporter certificate",
    supportKicker: "Where does it go?",
    supportTitle: "Explore the actions you support",
    supportLead: "Optional. Tap a card to see a short overview.",
    supportAria: "Actions to support",
    detail: "View details",
    supportNote: "No real donation is made in this demo.",
    trendKicker: "Safety in Shinjuku now",
    trendTitle: "Crime reports are trending down",
    trendBody: "But some people still feel uneasy.",
    trendStat: "Reported penal-code offenses: 10,968 in 2009 → 6,025 in 2024",
    trendNote: "Source: Tokyo Metropolitan Police Department open data. Details are available after creating your certificate.",
    displayNameLabel: "Display name (optional)",
    nameTab: "Enter here",
    nicknamePlaceholder: "e.g. Sakura",
    nicknameHelp: "Your name may appear on the certificate, the DOOH screen and the participant ranking.\nPlease use a nickname, not your real name.",
    inkLocationTitle: "Landed. This color still has no name.",
    inkLocationMessage: "This name will appear on the big screen.",
    nameLookUpTitle: "We received your name",
    nameLookUpBody: "Please watch the big screen.",
    nameLookUpClose: "View your certificate",
    nameQuietTitle: "Thank you for taking part",
    nameQuietBody: "Your certificate is ready.",
    namePublishError: "The ink did not arrive. Please try again.",
    supportSummary: "Your swipe supports Shinjuku renewal, walkable streets and local vitality.",
    supportDetailsOpen: "Explore where your support goes",
    rankingTitle: "Participant ranking",
    rankingKicker: "By total days taken part",
    rankingOpen: "View participant ranking",
    rankingClose: "Close ranking",
    rankingDays: "{days} days",
    rankingSelfNote: "You are ranked #{rank}.",
    rankingAnonymousNote: "Enter a name to appear in the ranking.",
    rankingEmpty: "Not enough participants yet to build a ranking.",
    fontLegend: "Choose name style",
    fontHelp: "Pick the look you like",
    supporterKicker: "For crowdfunding supporters",
    supporterTitle: "Show your message on the DOOH",
    supporterLead: "Enter your 4-digit passcode and\nsend a cheer for Shinjuku!",
    passcode: "Passcode",
    comment: "Short message",
    commentPlaceholder: "e.g. May Shinjuku stay welcoming for everyone",
    supporterHelp: "The passcode is the 4-digit number you received as a supporter. URLs and personal info cannot be shown.",
    createCard: "Send this name",
    skipName: "Leave it unnamed",
    shareTitle: "Your certificate is ready.",
    share: "Share",
    shareLine: "Send on LINE",
    shareX: "Post on X",
    copyLink: "Copy link",
    counterLabel: "Current participants",
    counterUnit: "",
    counterGoal: "Goal: {goal}",
    counterRemaining: "{remaining} to go",
    counterReached: "{goal} reached",
    milestoneKicker: "3000-Supporter Color Project",
    milestoneShifted: "The Shinjuku scene is changing",
    milestonePrimary: "{remaining} swipes until the next scene change",
    milestoneSecondary: "Total {count} / Goal {goal}",
    milestoneSecondaryReached: "Total {count} / Goal {goal}",
    detailAfterCard: "After creating your certificate, you can open the official Shinjuku City page.",
    projectNoteLabel: "About this demo",
    projectNoteText: "This is a class prototype. No real payment or donation is made.",
    projectNoteLink: "Learn about this project",
    dataLabel: "Source",
    dataTitle: "Reported penal-code offenses in Shinjuku City",
    dataLink: "View TMPD open data ↗",
    externalNote: "The official page opens separately.",
    more: "Learn more",
    surveyThanks: "Thank you",
    surveyDesc: "Your participation added light to Shinjuku.",
    surveyNote: "Thank you for participating.\nPlease answer the short survey next.",
    answerNow: "Answer now",
    autoMove: "Redirecting shortly…",
    youtubeEyebrow: "YouTube Live",
    youtubeTitle: "Send<br><span class=\"no-break\">support</span>",
    youtubeLead: "Scan the QR code and swipe. Your action will anonymously affect the live DOOH screen.",
    youtubeCopy: "This action is free. Your name and comments will not be shown.",
    youtubeSwipe: "Swipe up inside the finger area.",
    youtubeDoneTitle: "Sent",
    youtubeDoneCopy: "Your action will be reflected on the DOOH screen. Please check the live view.",
    youtubeDoneHint: "Check the DOOH screen. You can join again in about {remaining}.",
    youtubeLockedTitle: "Already<br><span class=\"no-break\">sent</span>",
    youtubeLockedCopy: "You can send the next support action in about {remaining}.",
    youtubeLockedHint: "Already sent. You can join again in about {remaining}.",
    sendFailed: "You can join once per day. See you again tomorrow!",
    sending: "Sending your support action…",
    busy: "The connection is busy. Please wait a moment and try again.",
    alreadyHint: "You have already joined today. Please come back tomorrow.",
    alreadyTitle: "Already joined today",
    certificateLabelAll: "SHINJUKU ACTION CERTIFICATE",
    certificateLabelDefault: "SHINJUKU COLOR SUPPORTER",
    certificateDescMorning: "This action is free. Sponsored funds will send ¥{amount} to a morning Shinjuku support destination.",
    certificateDescAll: "This action is free. Sponsored funds will send ¥{amount} to a destination that supports a more welcoming Shinjuku.",
    certificateDescDefault: "This action is free. Sponsored funds will send ¥{amount} to a support destination for Shinjuku.",
    certificateLabelSupporter: "FOUNDING SUPPORTER",
    certificateDescSupporter: "Your message will appear on the DOOH screen.",
    certificateSerial: "SERIAL No.{serial}",
    storyThanks: "Thank you. Showing one of the actions your support connects to.",
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
const restoredSwipeLink = restoreSwipeLink();
let completedSwipeEventId = restoredSwipeLink?.eventId ?? "";
let completedSwipeCount = restoredSwipeLink?.count ?? 0;
let hasShownSwipeReadyEffect = false;
let hasAnimatedCounter = false;
let isFinalCardBuilt = false;
let selectedSupportChoiceId = null;
let selectedTickerFont = "noto";
let isRegisteringParticipation = false;
let isAutoCompletingSwipe = false;
let swipeChargeValue = 0;
let counterAnimationFrame = null;
let counterAnimationDelayTimer = null;
let storyCardDismissTimer = null;
let youtubeCooldownTimer = null;
let copyFeedbackTimer = null;
let relightPlaylist = null;
updateCounterGoalProgress(participantCount);
const milestonePreview = buildMilestonePreview();
const milestoneKicker = milestonePreview?.querySelector("[data-milestone-kicker]");
const milestonePrimary = milestonePreview?.querySelector("[data-milestone-primary]");
const milestoneSecondary = milestonePreview?.querySelector("[data-milestone-secondary]");
const milestoneProgressBar = milestonePreview?.querySelector("[data-milestone-bar]");

function text(key, replacements = {}) {
  const dictionary = UI_TEXT[currentLanguage] || UI_TEXT.ja;
  let value = dictionary[key] ?? UI_TEXT.ja[key] ?? "";
  if (Array.isArray(value)) {
    return value;
  }
  Object.entries(replacements).forEach(([name, replacement]) => {
    value = value.replaceAll(`{${name}}`, String(replacement));
  });
  return value;
}

function syncInkLocationMap() {
  renderInkLocationMap(inkLocationCard, completedSwipeCount, {
    language: currentLanguage,
    title: text("inkLocationTitle"),
    message: text("inkLocationMessage"),
  });
}

function supportChoiceDetailFor(choiceId) {
  const choices = SUPPORT_CHOICE_TRANSLATIONS[currentLanguage] || SUPPORT_CHOICE_TRANSLATIONS.ja;
  return choices[choiceId] || SUPPORT_CHOICE_DETAILS[choiceId];
}

function setElementText(selector, value) {
  const element = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (element) {
    element.textContent = value;
  }
}

function setElementHtml(selector, value) {
  const element = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (element) {
    element.innerHTML = value;
  }
}

function ensureLanguageToggle() {
  const appbar = document.querySelector(".sparkle-appbar");
  if (!appbar || appbar.querySelector("[data-language-toggle]")) {
    return;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "language-toggle";
  button.dataset.languageToggle = "1";
  button.addEventListener("click", () => {
    setLanguage(isEnglish() ? "ja" : "en", { persist: true });
  });
  const aboutLink = appbar.querySelector("[data-about-link]");
  if (aboutLink) {
    aboutLink.before(button);
  } else {
    appbar.append(button);
  }
}

function syncLanguageToggle() {
  const toggle = document.querySelector("[data-language-toggle]");
  if (toggle) {
    toggle.textContent = isEnglish() ? "JA" : "EN";
    toggle.setAttribute("aria-label", isEnglish() ? "日本語に切り替え" : "Switch to English");
  }
}

function setMultilineText(element, value) {
  if (!element) return;
  element.replaceChildren();
  String(value).split("\n").forEach((line, index) => {
    if (index > 0) {
      element.append(document.createElement("br"));
    }
    element.append(line);
  });
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  doohGazePrompt?.update(currentLanguage, {
    overlayTitle: text("nameLookUpTitle"),
    overlayBody: text("nameLookUpBody"),
    close: text("nameLookUpClose"),
    quietTitle: text("nameQuietTitle"),
    quietBody: text("nameQuietBody"),
  });
  document.title = text("pageTitle");
  steps.forEach((step, index) => {
    const label = text("progressLabels")[index];
    if (label) step.dataset.label = label;
  });

  setElementText("[data-about-link]", text("about"));
  setElementText("#stepBack", text("back"));
  setElementText(".eyebrow", text("eyebrow"));
  setElementHtml("#campaignTitle", text("campaignTitle"));
  setElementText(".lead", text("lead"));
  setElementHtml("#swipeTitle", text("swipeTitle"));
  setElementHtml(".funding-note", text("fundingNote"));
  setElementText(".donation-preview span", text("donationLabel"));
  setElementText(".donation-preview strong", text("free"));
  setElementText(".swipe-instruction", text("swipeInstruction"));
  setElementText("#thanksTitle", text("thanksTitle"));
  setElementText(steps[1]?.querySelector("p"), text("thanksBody"));
  setElementText("#certificateTitle", text("certificateTitle"));
  setElementText(".support-choice-kicker", text("supportKicker"));
  setElementText("#supportChoiceTitle", text("supportTitle"));
  setElementText(".support-choice-lead", text("supportLead"));
  document.querySelector(".support-choice-options")?.setAttribute("aria-label", text("supportAria"));
  setElementText(".support-choice-note", text("supportNote"));
  setElementText(".support-trend-kicker", text("trendKicker"));
  setElementText("#supportTrendTitle", text("trendTitle"));
  setElementText(".support-trend div > p:not(.support-trend-kicker)", text("trendBody"));
  setElementText(".support-trend-stat", text("trendStat"));
  setElementText(".support-trend-note", text("trendNote"));
  setElementText("label[for='nickname']", text("displayNameLabel"));
  setElementText(".sparkle-name-tab", text("nameTab"));
  if (nickname) nickname.placeholder = text("nicknamePlaceholder");
  setMultilineText(nicknameHelp, text("nicknameHelp"));
  syncInkLocationMap();
  setElementText("[data-support-summary]", text("supportSummary"));
  setElementText("[data-support-details-open]", text("supportDetailsOpen"));
  setElementText(".ticker-font-picker legend", text("fontLegend"));
  setElementText("#tickerFontHelp", text("fontHelp"));
  setElementText(".supporter-comment-kicker", text("supporterKicker"));
  setElementText("#supporterCommentTitle", text("supporterTitle"));
  setMultilineText(document.querySelector(".supporter-comment-lead"), text("supporterLead"));
  setElementText("label[for='supporterPasscode'] span", text("passcode"));
  setElementText("label[for='supporterComment'] span", text("comment"));
  if (supporterComment) supporterComment.placeholder = text("commentPlaceholder");
  setElementText("#supporterCommentHelp", text("supporterHelp"));
  setElementText("#createCard", text("createCard"));
  setElementText("#skipName", text("skipName"));
  setElementText("#shareTitle", text("shareTitle"));
  setElementText("#rankingTitle", text("rankingTitle"));
  setElementText("#rankingKicker", text("rankingKicker"));
  updateRankingToggleLabel();
  paintRanking();   // 行と注記は言語ごとに作り直す
  setElementText("#shareBtn", text("share"));
  setElementText("#shareLineBtn", text("shareLine"));
  setElementText("#shareXBtn", text("shareX"));
  setElementText("#shareCopyBtn", text("copyLink"));
  setElementText(".outro-note", text("surveyNote"));
  setElementText("#outroAnswerBtn", text("answerNow"));
  setElementText(".outro-auto", text("autoMove"));

  supportChoiceButtons.forEach((button) => {
    const detail = supportChoiceDetailFor(button.dataset.supportChoice);
    setElementText(button.querySelector("span"), detail?.title || "");
    setElementText(button.querySelector("small"), text("detail"));
  });

  if (selectedSupportChoiceId && supportChoiceDetail && !supportChoiceDetail.hidden) {
    const detail = supportChoiceDetailFor(selectedSupportChoiceId);
    supportChoiceDetail.replaceChildren();
    const title = document.createElement("h4");
    title.textContent = detail.title;
    const description = document.createElement("p");
    description.textContent = detail.description;
    const note = document.createElement("small");
    note.className = "support-choice-complete-note";
    note.textContent = text("detailAfterCard");
    supportChoiceDetail.append(title, description, note);
  }

  updateCounterGoalProgress(participantCount);
  updateMilestonePreview(participantCount);
  updateProgress(currentStep);
  setupAboutLinks();
  syncLanguageToggle();
  if (isYouTubeParticipation) {
    applyYouTubeParticipationCopy();
  }
}

function setLanguage(nextLanguage, options = {}) {
  currentLanguage = normalizeLanguage(nextLanguage);
  if (options.persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch {
      /* Storage may be unavailable in some in-app browsers. */
    }
  }
  applyLanguage();
}

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
  counterValue.textContent = participantCount.toLocaleString("ja-JP");
  updateCounterGoalProgress(participantCount);
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

function getOrCreateYouTubeVisitorId(record = {}) {
  if (typeof record.visitorId === "string" && record.visitorId) {
    return record.visitorId;
  }
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `youtube-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function readYouTubeParticipationRecord() {
  try {
    return JSON.parse(localStorage.getItem(YOUTUBE_PARTICIPATION_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getYouTubeCooldownState(now = Date.now()) {
  const record = readYouTubeParticipationRecord();
  const lastCompletedAt = Number(record.lastCompletedAt) || 0;
  const elapsed = lastCompletedAt > 0 ? now - lastCompletedAt : Infinity;
  const remainingMs = Math.max(YOUTUBE_PARTICIPATION_COOLDOWN_MS - elapsed, 0);
  return {
    blocked: remainingMs > 0,
    remainingMs,
    visitorId: getOrCreateYouTubeVisitorId(record),
  };
}

function saveYouTubeParticipation(visitorId) {
  localStorage.setItem(YOUTUBE_PARTICIPATION_STORAGE_KEY, JSON.stringify({
    visitorId,
    lastCompletedAt: Date.now(),
  }));
}

function formatCooldownTime(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (isEnglish()) {
    if (ms < 60000) {
      return `${seconds} sec`;
    }
    const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) {
      return `${minutes} min`;
    }
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
  if (ms < 60000) {
    return `${seconds}秒`;
  }
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}分`;
  }
  return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
}

const RANDOM_GUEST_NAME = generateRandomGuestName();

function getDisplayName() {
  const input = nickname.value.trim();
  if (!input || isInappropriateName(input)) {
    return RANDOM_GUEST_NAME;
  }
  return input;
}

function normalizeTickerFont(value) {
  return TICKER_FONT_IDS.has(value) ? value : "noto";
}

function setSelectedTickerFont(value, options = {}) {
  selectedTickerFont = normalizeTickerFont(value);
  tickerFontButtons.forEach((button) => {
    const isSelected = button.dataset.tickerFont === selectedTickerFont;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  // 選んだ書体を参加証プレビューの名前と、入力欄の文字へ即時反映する。
  if (previewName) {
    previewName.dataset.tickerFont = selectedTickerFont;
  }
  if (nickname) {
    nickname.dataset.tickerFont = selectedTickerFont;
  }

  if (options.persist !== false) {
    try {
      localStorage.setItem(tickerFontStorageKey, selectedTickerFont);
    } catch {
      // The page still works when storage is unavailable.
    }
  }
}

function restoreSelectedTickerFont() {
  try {
    setSelectedTickerFont(localStorage.getItem(tickerFontStorageKey), { persist: false });
  } catch {
    setSelectedTickerFont("noto", { persist: false });
  }
}

function setNicknameHelp(message, status = "") {
  if (!nicknameHelp) {
    return;
  }
  nicknameHelp.textContent = message || defaultNicknameHelpText;
  nicknameHelp.dataset.status = status;
  nicknameHelp.setAttribute("aria-live", status ? "polite" : "off");
}

function restoreNicknameHelp() {
  setNicknameHelp(isEnglish() ? text("nicknameHelp") : defaultNicknameHelpText, "");
}

function setNameChecking(isChecking) {
  if (isChecking && nickname?.value.trim()) {
    setInkLocationStatus(inkLocationCard, "sending", currentLanguage);
  }
  if (createCardButton) {
    createCardButton.disabled = isChecking;
    createCardButton.setAttribute("aria-busy", String(isChecking));
  }
  if (skipNameButton) {
    skipNameButton.disabled = isChecking;
  }
}

function setSupporterCommentHelp(message, status = "") {
  if (!supporterCommentHelp) {
    return;
  }
  supporterCommentHelp.textContent = message || defaultSupporterCommentHelpText;
  supporterCommentHelp.dataset.status = status;
  supporterCommentHelp.setAttribute("aria-live", status ? "polite" : "off");
}

function restoreSupporterCommentHelp() {
  setSupporterCommentHelp(isEnglish() ? text("supporterHelp") : defaultSupporterCommentHelpText, "");
}

function setSupporterAutoCodeButtonState(button, isChecking) {
  if (!button) {
    return;
  }
  button.disabled = isChecking;
  button.setAttribute("aria-busy", String(isChecking));
  button.textContent = isChecking ? "コード確認中..." : "デモ用コードを自動入力";
}

async function chooseAvailableDemoSupporterCode(button) {
  if (!supporterPasscode) {
    return;
  }

  setSupporterAutoCodeButtonState(button, true);
  setSupporterCommentHelp(SUPPORTER_DEMO_CODE_CHECKING, "checking");

  try {
    const demoCodes = await getDemoSupporterPasscodes();
    if (!demoCodes.length) {
      setSupporterCommentHelp(SUPPORTER_PASSCODE_ERROR, "error");
      return;
    }

    let usedHashes = new Set();
    if (!isDebugReplay) {
      try {
        const comments = await getSupporterComments({ channel: PARTICIPATION_CHANNEL });
        usedHashes = new Set(
          comments
            .map((comment) => String(comment.codeHash ?? "").toLowerCase())
            .filter((codeHash) => /^[a-f0-9]{64}$/.test(codeHash))
        );
      } catch (error) {
        console.info("[supporter-passcode] could not check used demo codes:", error);
      }
    }

    const verifiedCodes = [];
    for (const code of demoCodes) {
      const verification = await verifySupporterPasscode(code);
      if (verification.ok) {
        verifiedCodes.push({ code, codeHash: verification.codeHash });
      }
    }

    if (!verifiedCodes.length) {
      setSupporterCommentHelp(SUPPORTER_PASSCODE_ERROR, "error");
      return;
    }

    const availableCodes = verifiedCodes.filter((candidate) => !usedHashes.has(candidate.codeHash));
    const selectedPool = availableCodes.length ? availableCodes : verifiedCodes;
    const selected = selectedPool[Math.floor(Math.random() * selectedPool.length)];
    const wasFallback = usedHashes.has(selected.codeHash);
    supporterPasscode.value = selected.code;
    supporterPasscode.dispatchEvent(new Event("input", { bubbles: true }));
    setSupporterCommentHelp(wasFallback ? SUPPORTER_DEMO_CODE_FULL : SUPPORTER_DEMO_CODE_READY, wasFallback ? "checking" : "success");
    if (supporterComment && !supporterComment.value.trim()) {
      supporterComment.focus();
    }
  } catch (error) {
    console.info("[supporter-passcode] demo code allocation failed:", error);
    setSupporterCommentHelp(SUPPORTER_PASSCODE_ERROR, "error");
  } finally {
    setSupporterAutoCodeButtonState(button, false);
  }
}

function setupSupporterDemoCodeButton() {
  if (!supporterPasscode) {
    return;
  }
  const field = supporterPasscode.closest(".supporter-passcode-field");
  if (!field || field.querySelector("[data-supporter-demo-code]")) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "supporter-demo-code-button";
  button.dataset.supporterDemoCode = "1";
  button.textContent = "デモ用パスコードを自動入力";
  button.addEventListener("click", () => {
    chooseAvailableDemoSupporterCode(button);
  });
  field.appendChild(button);
}

// 同じパスコードなら毎回同じ番号が出るよう、ハッシュから通し番号を導く。
function markFoundingSupporter(codeHash) {
  isFoundingSupporter = true;
  const seed = /^[a-f0-9]{6}/.test(String(codeHash ?? "")) ? codeHash.slice(0, 6) : "";
  const serial = seed ? parseInt(seed, 16) % 10000 : 0;
  foundingSupporterSerial = String(serial).padStart(4, "0");
}

function getSupporterCommentInput() {
  return {
    code: String(supporterPasscode?.value ?? "").replace(/\D/g, "").slice(0, 4),
    comment: String(supporterComment?.value ?? "").trim().slice(0, 40),
  };
}

async function publishOptionalSupporterComment(displayName = "") {
  if (!supporterPasscode || !supporterComment) {
    return true;
  }

  const input = getSupporterCommentInput();
  const hasAnyInput = Boolean(input.code || input.comment);
  if (!hasAnyInput) {
    restoreSupporterCommentHelp();
    return true;
  }

  if (!/^\d{4}$/.test(input.code)) {
    setSupporterCommentHelp(SUPPORTER_PASSCODE_ERROR, "error");
    supporterPasscode.focus();
    return false;
  }
  if (!input.comment || isInappropriateName(input.comment)) {
    setSupporterCommentHelp(SUPPORTER_COMMENT_ERROR, "error");
    supporterComment.focus();
    return false;
  }

  setSupporterCommentHelp(SUPPORTER_CHECKING_MESSAGE, "checking");
  const verification = await verifySupporterPasscode(input.code);
  if (!verification.ok) {
    setSupporterCommentHelp(SUPPORTER_PASSCODE_ERROR, "error");
    supporterPasscode.focus();
    return false;
  }

  markFoundingSupporter(verification.codeHash);
  foundingSupporterComment = input.comment;

  if (isDebugReplay) {
    setSupporterCommentHelp(SUPPORTER_COMMENT_SAVED, "success");
    return true;
  }

  const payload = {
    channel: PARTICIPATION_CHANNEL,
    codeHash: verification.codeHash,
    comment: input.comment,
    name: displayName,
    visitorId: completedParticipationVisit?.visitorId ?? null,
    swipeEventId: completedSwipeEventId || null,
    swipeCount: completedSwipeCount || null,
    source: isAllExperience
      ? "participant-flow-all"
      : isMenExperience
        ? "participant-flow-men"
        : isSparkleExperience
          ? "participant-flow-women"
          : "participant-flow",
  };
  const result = await publishSupporterComment(payload);
  if (result?.blocked || result?.failed) {
    setSupporterCommentHelp(SUPPORTER_COMMENT_ERROR, "error");
    return false;
  }

  setSupporterCommentHelp(SUPPORTER_COMMENT_SAVED, "success");
  return true;
}

async function validateTypedDisplayName() {
  const typed = nickname.value.trim();
  if (!typed) {
    restoreNicknameHelp();
    return { ok: true, name: "" };
  }

  if (isLiveShowcaseDemo) {
    if (isInappropriateName(typed)) {
      setNicknameHelp(NAME_BLOCKED_MESSAGE, "error");
      nickname.setAttribute("aria-invalid", "true");
      nickname.focus();
      return { ok: false, reason: "blocked" };
    }
    nickname.removeAttribute("aria-invalid");
    restoreNicknameHelp();
    return { ok: true, name: typed };
  }

  setNicknameHelp(NAME_CHECKING_MESSAGE, "checking");
  const result = await moderateDisplayName(typed);
  if (!result.allowed) {
    setNicknameHelp(NAME_BLOCKED_MESSAGE, "error");
    nickname.setAttribute("aria-invalid", "true");
    nickname.focus();
    return { ok: false, reason: result.reason ?? "blocked" };
  }

  nickname.removeAttribute("aria-invalid");
  restoreNicknameHelp();
  return { ok: true, name: typed };
}

function getDemoDonationTotal(count = participantCount) {
  return count * DEMO_DONATION_YEN;
}

function getParticipantGoalStatus(count = participantCount) {
  const current = Math.max(0, Math.floor(Number(count) || 0));
  const remaining = Math.max(MONTHLY_PARTICIPANT_GOAL - current, 0);
  const progress = Math.min((current / MONTHLY_PARTICIPANT_GOAL) * 100, 100);
  return { current, remaining, progress, reached: remaining === 0 };
}

function updateCounterGoalProgress(count = participantCount) {
  if (!counterBox) {
    return;
  }

  const status = getParticipantGoalStatus(count);
  counterBox.classList.add("is-participant-goal");
  counterBox.style.setProperty("--counter-goal-progress", `${status.progress}%`);

  if (counterLabel) {
    counterLabel.textContent = text("counterLabel");
  }
  if (counterUnit) {
    counterUnit.textContent = text("counterUnit");
  }
  if (counterBadge) {
    counterBadge.textContent = text("counterGoal", {
      goal: MONTHLY_PARTICIPANT_GOAL.toLocaleString(isEnglish() ? "en-US" : "ja-JP"),
    });
  }
  if (counterDetail) {
    counterDetail.textContent = status.reached
      ? text("counterReached", {
          goal: MONTHLY_PARTICIPANT_GOAL.toLocaleString(isEnglish() ? "en-US" : "ja-JP"),
        })
      : text("counterRemaining", {
          remaining: status.remaining.toLocaleString(isEnglish() ? "en-US" : "ja-JP"),
        });
  }
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
  kicker.dataset.milestoneKicker = "";
  kicker.textContent = text("milestoneKicker");

  const primary = document.createElement("strong");
  primary.dataset.milestonePrimary = "";
  primary.textContent = text("milestonePrimary", { remaining: "9" });

  const secondary = document.createElement("small");
  secondary.dataset.milestoneSecondary = "";
  secondary.textContent = text("milestoneSecondary", { count: "0", goal: "3,000" });

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
  const numberLocale = isEnglish() ? "en-US" : "ja-JP";
  const formattedCount = safeCount.toLocaleString(numberLocale);
  const formattedTotalGoal = TOTAL_PARTICIPANT_GOAL.toLocaleString(numberLocale);
  const roundPosition = safeCount % VISUAL_CHANGE_INTERVAL;
  const remainingToNextVisual = roundPosition === 0 && safeCount > 0
    ? 0
    : VISUAL_CHANGE_INTERVAL - roundPosition;
  const progressToNextVisual = remainingToNextVisual === 0
    ? 100
    : (roundPosition / VISUAL_CHANGE_INTERVAL) * 100;
  const justReachedVisualShift = remainingToNextVisual === 0 && safeCount > 0;

  milestonePreview.classList.toggle("is-reached", justReachedVisualShift);
  milestonePreview.style.setProperty("--milestone-progress", `${progressToNextVisual}%`);

  if (milestoneKicker) {
    milestoneKicker.textContent = text("milestoneKicker");
  }

  if (milestonePrimary) {
    milestonePrimary.textContent = justReachedVisualShift
      ? text("milestoneShifted")
      : text("milestonePrimary", {
          remaining: remainingToNextVisual.toLocaleString(numberLocale),
        });
  }

  if (milestoneSecondary) {
    milestoneSecondary.textContent = text("milestoneSecondary", {
      count: formattedCount,
      goal: formattedTotalGoal,
    });
  }

  if (milestoneProgressBar) {
    milestoneProgressBar.style.width = `${progressToNextVisual}%`;
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

  if (options.forceCounter || hasCountedParticipation || currentStep === 1) {
    updateCounterGoalProgress(participantCount);
  }

  // The supporter route can reach the certificate before the initial Firebase
  // count has arrived. If the count screen is open, replay with the live value
  // instead of leaving the placeholder at zero.
  if (currentStep === 1 && hasAnimatedCounter && counterValue) {
    const displayedCount = Number(counterValue.textContent.replace(/[^0-9]/g, "")) || 0;
    if (displayedCount !== participantCount) {
      animateCounter(participantCount);
    }
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

  if (isYouTubeParticipation && !hasTrackedYouTubeSwipeStart && normalized >= 8) {
    hasTrackedYouTubeSwipeStart = true;
    logAnalyticsEvent("youtube_swipe_start", {
      channel: "youtube",
      experience: isMenExperience ? "men" : "women",
    });
  }
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

// 参加者ランキング。nameShouts（名前）と participantHistory（日数）を
// visitorId で突き合わせた結果が getRecentNameAnnouncements から返る。
const RANKING_TOP = 10;
const rankingPanel = document.getElementById("rankingPanel");
const rankingToggle = document.getElementById("rankingToggle");
const rankingToggleLabel = document.getElementById("rankingToggleLabel");
const rankingBody = document.getElementById("rankingBody");
const rankingList = document.getElementById("rankingList");
const rankingNote = document.getElementById("rankingNote");
let rankingLoaded = false;
let rankingData = null;    // 言語を切り替えたときに描き直せるよう保持する
let rankingSelfIndex = -1;
let rankingAnnouncements = [];
let rankingLiveUnsubscribe = null;
let rankingLiveStarting = false;
let rankingRefreshTimer = null;

function updateRankingToggleLabel() {
  if (!rankingToggle || !rankingToggleLabel) return;
  const isOpen = rankingToggle.getAttribute("aria-expanded") === "true";
  rankingToggleLabel.textContent = text(isOpen ? "rankingClose" : "rankingOpen");
  const icon = rankingToggle.querySelector(".ranking-toggle-icon");
  if (icon) icon.textContent = isOpen ? "−" : "＋";
}

rankingToggle?.addEventListener("click", () => {
  const willOpen = rankingToggle.getAttribute("aria-expanded") !== "true";
  rankingToggle.setAttribute("aria-expanded", String(willOpen));
  if (rankingBody) rankingBody.hidden = !willOpen;
  updateRankingToggleLabel();
});

function refreshLiveRanking() {
  rankingRefreshTimer = null;
  const ranking = buildRanking(rankingAnnouncements);
  if (ranking.length === 0) return;
  const myVisitorId = completedParticipationVisit?.visitorId ?? null;
  rankingData = ranking;
  rankingSelfIndex = myVisitorId ? ranking.findIndex((entry) => entry.visitorId === myVisitorId) : -1;
  paintRanking();
}

function queueLiveRankingEntry(entry) {
  if (!entry?.id) return;
  const existingIndex = rankingAnnouncements.findIndex((current) => current.id === entry.id);
  if (existingIndex >= 0) rankingAnnouncements.splice(existingIndex, 1);
  rankingAnnouncements.push(entry);
  window.clearTimeout(rankingRefreshTimer);
  rankingRefreshTimer = window.setTimeout(refreshLiveRanking, 300);
}

async function startLiveRanking(knownIds) {
  if (rankingLiveUnsubscribe || rankingLiveStarting) return;
  rankingLiveStarting = true;
  try {
    rankingLiveUnsubscribe = await subscribeToNameAnnouncements(queueLiveRankingEntry, {
      channel: PARTICIPATION_CHANNEL,
      knownIds,
    });
  } catch (error) {
    console.info("[participant] live ranking unavailable:", error);
  } finally {
    rankingLiveStarting = false;
  }
}

window.addEventListener("pagehide", () => {
  rankingLiveUnsubscribe?.();
  rankingLiveUnsubscribe = null;
  window.clearTimeout(rankingRefreshTimer);
});

function buildRanking(announcements) {
  // 同じ人が複数回名乗っているので、最新の名前と最大の通算日数にまとめる
  const byVisitor = new Map();
  for (const entry of announcements) {
    const visitorId = typeof entry?.visitorId === "string" ? entry.visitorId : "";
    const name = String(entry?.name ?? "").trim();
    if (!visitorId || !name) {
      continue;
    }
    const totalDays = Math.max(1, Number(entry.totalDays) || 1);
    const createdAt = Number(entry.createdAt) || 0;
    const current = byVisitor.get(visitorId);
    if (!current || createdAt >= current.createdAt) {
      byVisitor.set(visitorId, { visitorId, name, createdAt, totalDays: Math.max(totalDays, current?.totalDays ?? 0) });
    } else if (totalDays > current.totalDays) {
      current.totalDays = totalDays;
    }
  }

  return [...byVisitor.values()].sort(
    (a, b) => b.totalDays - a.totalDays || a.name.localeCompare(b.name, "ja")
  );
}

function rankingRow(entry, rank, isSelf) {
  const li = document.createElement("li");
  li.className = "ranking-row";
  li.classList.toggle("is-self", isSelf);
  if (rank <= 3) {
    li.dataset.medal = String(rank);
  }
  const r = document.createElement("span");
  r.className = "ranking-rank";
  r.textContent = String(rank);
  const n = document.createElement("span");
  n.className = "ranking-name";
  n.textContent = entry.name;
  const d = document.createElement("span");
  d.className = "ranking-days";
  d.textContent = text("rankingDays", { days: entry.totalDays });
  li.append(r, n, d);
  return li;
}

async function renderRanking() {
  if (!rankingPanel || !rankingList || rankingLoaded) {
    return;
  }
  rankingLoaded = true;

  let ranking = [];
  try {
    const announcements = await getRecentNameAnnouncements({ all: true, channel: PARTICIPATION_CHANNEL });
    rankingAnnouncements = announcements;
    ranking = buildRanking(announcements);
    startLiveRanking(announcements.map((entry) => entry.id).filter(Boolean));
  } catch (error) {
    console.info("[participant] ranking unavailable:", error);
    rankingLoaded = false;
    return;
  }
  if (ranking.length === 0) {
    return;
  }

  const myVisitorId = completedParticipationVisit?.visitorId ?? null;
  rankingData = ranking;
  rankingSelfIndex = myVisitorId ? ranking.findIndex((entry) => entry.visitorId === myVisitorId) : -1;
  paintRanking();
}

function paintRanking() {
  if (!rankingPanel || !rankingList || !rankingData) {
    return;
  }
  const myIndex = rankingSelfIndex;

  rankingList.replaceChildren();
  rankingData.slice(0, RANKING_TOP).forEach((entry, i) => {
    rankingList.append(rankingRow(entry, i + 1, i === myIndex));
  });

  // 圏外の自分は、区切りを挟んで下に足す
  if (myIndex >= RANKING_TOP) {
    const gap = document.createElement("li");
    gap.className = "ranking-gap";
    gap.textContent = "···";
    rankingList.append(gap, rankingRow(rankingData[myIndex], myIndex + 1, true));
  }

  if (rankingNote) {
    rankingNote.textContent = myIndex >= 0
      ? text("rankingSelfNote", { rank: myIndex + 1 })
      : text("rankingAnonymousNote");
  }
  rankingPanel.hidden = false;
}

function showStep(index) {
  const previousStepIndex = currentStep;
  const isReturningToCount = index === 1 && previousStepIndex > 1;
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  if (index !== 1) {
    window.clearTimeout(counterAnimationDelayTimer);
    counterAnimationDelayTimer = null;
  }
  if (isReturningToCount) {
    hasAnimatedCounter = false;
  }

  currentStep = index;
  if (isLiveShowcaseDemo && index === 2) {
    window.setTimeout(applyShowcaseDemoName, 0);
  }
  // 支援者ページでも intent はボタン側で明示的に決める。
  // ここで強制的に true にすると「通常参加証」を選んでも支援者版扱いになってしまう。
  syncMobileCertificateActions(index);
  if (sectionJumpNav) {
    sectionJumpNav.hidden = index !== 2;
    if (index !== 2) setSectionJumpMenuOpen(false);
  }
  viewport.classList.toggle("is-participation-step", index === 0);
  steps.forEach((step, stepIndex) => {
    const isCurrent = stepIndex === index;
    step.classList.toggle("is-current", isCurrent);
    step.setAttribute("aria-hidden", String(!isCurrent));
  });

  setTrackPosition(index);
  updateProgress(index);
  app.classList.toggle("is-post-participation", index >= 1);
  document.body.classList.toggle("has-color-participation", index >= 1);
  app.classList.toggle("is-share-ready", index === totalSteps - 1);
  if (index === totalSteps - 1) {
    renderRanking();
  }
  if (stepBackButton) {
    stepBackButton.hidden = index <= 1 || index >= totalSteps - 1;
  }

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
    updateCounterGoalProgress(participantCount);
    if (counterValue && !prefersReducedMotion) {
      // ロールアップ開始前のプレースホルダも0から（HTML初期値の名残の100を見せない）
      counterValue.textContent = "0";
    }
    counterAnimationDelayTimer = window.setTimeout(() => {
      counterAnimationDelayTimer = null;
      if (currentStep === 1) {
        animateCounter(participantCount);
      }
    }, delay);
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
  // 参加証の降臨演出中は数えない。演出の終わりに改めて呼び直す。
  if (isCeremonyPlaying) {
    return;
  }
  // 調査用プレビューでは親画面がDOOH表示後のアンケート遷移を管理する。
  if (window.parent !== window) {
    return;
  }
  // debug: 外部アンケートに飛ばさず、最初のスワイプ画面に戻して文言を見直せるようにする。
  if (isDebugReplay) {
    formRedirectTimer = window.setTimeout(() => {
      formRedirectTimer = null;
      resetFlowForDebug();
    }, DEBUG_REPLAY_RESET_MS);
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

// debug: 全ての「1回きり」ガードを解除して、最初のスワイプ画面に戻す。
// host/ローカルで文言を直しながら何度でもスワイプを試せるようにするための機能。
function resetFlowForDebug() {
  window.clearTimeout(formRedirectTimer);
  window.clearTimeout(outroSceneTimer);
  window.clearTimeout(storyCardDismissTimer);
  clearYouTubeCooldownTimer();
  formRedirectTimer = null;
  outroSceneTimer = null;
  storyCardDismissTimer = null;

  closeOutro();
  storyCardOverlay?.classList.remove("is-active");
  storyCardOverlay?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-story-card-open");

  // 支援者の状態を残すと、次の周回でコード未入力でも金の参加証が出てしまう。
  clearCeremonyTimers();
  isCeremonyPlaying = false;
  isFoundingSupporter = false;
  foundingSupporterSerial = "";
  foundingSupporterComment = "";
  // これを戻さないと announceDonorName が即 return し、2周目以降は認証自体が走らない。
  hasAnnouncedName = false;
  ceremonyOverlay?.classList.remove("is-active", "is-converging", "is-lifting", "is-bursting");
  finalCard?.classList.remove("is-founding-supporter", "is-arriving", "has-color-ticket", "is-crowdfunding-ticket", "is-issuing");
  document.querySelectorAll("[data-supporter-keepsake]").forEach((button) => {
    button.hidden = true;
  });

  hasCountedParticipation = false;
  hasAcceptedParticipation = false;
  hasAnimatedCounter = false;
  isAutoCompletingSwipe = false;
  isRegisteringParticipation = false;
  hasShownSwipeReadyEffect = false;
  swipeCardShown = false;
  swipeCardDone = false;
  outroStarted = false;
  selectedSupportChoiceId = null;
  setSupportColor(null);
  document.body.classList.remove("has-color-participation");
  supportChoiceButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
  supportChoiceDetail?.replaceChildren();
  if (supportChoiceDetail) {
    supportChoiceDetail.hidden = true;
    supportChoiceDetail.classList.remove("is-visible");
  }

  swipeStep?.classList.remove("is-participation-locked");
  swipeControl?.removeAttribute("aria-disabled");

  updateSwipeCharge(0);
  if (swipeHint) {
    swipeHint.textContent = "";
  }
  showStep(0);
}

// debug 時だけ、いつでもスワイプ画面に戻せる小さなボタンを出す。
function mountDebugReplayButton() {
  if (!isDebugReplay) {
    return;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "↺ もう一度スワイプ (debug)";
  button.setAttribute("aria-label", "デバッグ用：最初のスワイプ画面に戻る");
  Object.assign(button.style, {
    position: "fixed",
    left: "50%",
    bottom: "12px",
    transform: "translateX(-50%)",
    zIndex: "9999",
    padding: "8px 14px",
    fontSize: "12px",
    lineHeight: "1",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.4)",
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    cursor: "pointer",
    backdropFilter: "blur(4px)",
  });
  button.addEventListener("click", resetFlowForDebug);
  document.body.appendChild(button);
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
  const scene = (isEnglish() ? OUTRO_SCENES_EN : OUTRO_SCENES)[index];
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

  const baseLead = Number(document.body?.dataset?.postFlowLead) || 1800;
  const lead = baseLead + (isFoundingSupporter ? SUPPORTER_OUTRO_EXTRA_LEAD_MS : 0);
  const autoMs = Number(document.body?.dataset?.postFlowDelay) || 5000;

  if (outroAnswerBtn) {
    outroAnswerBtn.addEventListener("click", () => redirectToForm(formUrl), { once: true });
  }

  window.setTimeout(() => {
    if (outroGlyph) outroGlyph.textContent = "favorite";
    if (outroTitle) outroTitle.textContent = text("surveyThanks");
    if (outroDesc) outroDesc.textContent = text("surveyDesc");
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
    counterValue.textContent = target.toLocaleString(isEnglish() ? "en-US" : "ja-JP");
    updateCounterGoalProgress(target);
    counterBox.classList.remove("is-counting");
    counterBox.classList.add("is-counted");
    return;
  }

  counterBox.classList.add("is-counting");

  // 0から最終値までロールアップして「参加が積み上がってきた」動きを見せ、
  // 最後に数字がポップして自分の1人が加わったことを示す
  const startValue = 0;
  const duration = 1900;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const value = Math.round(startValue + (target - startValue) * eased);
    counterValue.textContent = value.toLocaleString(isEnglish() ? "en-US" : "ja-JP");
    updateCounterGoalProgress(value);

    if (progress < 1) {
      counterAnimationFrame = requestAnimationFrame(tick);
      return;
    }

    counterAnimationFrame = null;
    counterValue.textContent = target.toLocaleString(isEnglish() ? "en-US" : "ja-JP");
    updateCounterGoalProgress(target);
    counterBox.classList.remove("is-counting");
    counterBox.classList.add("is-counted");
    counterValue.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.16)", offset: 0.4 },
        { transform: "scale(1)" },
      ],
      { duration: 480, easing: "cubic-bezier(0.22, 1.4, 0.36, 1)" }
    );
  }

  counterAnimationFrame = requestAnimationFrame(tick);
}

function restoreParticipantCounterImmediately() {
  if (!counterValue || !counterBox) {
    return;
  }

  window.clearTimeout(counterAnimationDelayTimer);
  counterAnimationDelayTimer = null;
  if (counterAnimationFrame) {
    cancelAnimationFrame(counterAnimationFrame);
    counterAnimationFrame = null;
  }

  hasAnimatedCounter = true;
  counterValue.textContent = participantCount.toLocaleString(isEnglish() ? "en-US" : "ja-JP");
  updateCounterGoalProgress(participantCount);
  counterBox.classList.remove("is-counting");
  counterBox.classList.add("is-counted");
}

function nextStep() {
  if (currentStep < totalSteps - 1) {
    showStep(currentStep + 1);
  }
}

function previousStep() {
  if (currentStep > 1 && currentStep < totalSteps - 1) {
    const previousIndex = currentStep - 1;
    if (previousIndex === 1) {
      hasAnimatedCounter = false;
    }
    showStep(previousIndex);
  }
}

function ensureSupportChoice() {
  return true;
}

function getCertificateContent() {
  const name = getDisplayName();
  const amountYen = DEMO_DONATION_YEN.toLocaleString(isEnglish() ? "en-US" : "ja-JP");

  if (isFoundingSupporter) {
    return {
      label: text("certificateLabelSupporter"),
      name,
      description: text("certificateDescSupporter", { amount: amountYen }),
    };
  }

  const label = activeTheme === "morning"
    ? "SHINJUKU MORNING SUPPORTER"
    : isAllExperience
      ? text("certificateLabelAll")
    : isMenExperience
      ? "CERTIFICATE OF SUPPORT"
    : isSparkleExperience
      ? "CERTIFICATE OF SUPPORT"
      : text("certificateLabelDefault");

  const amount = amountYen;
  const description = activeTheme === "morning"
    ? text("certificateDescMorning", { amount })
    : isAllExperience
      ? text("certificateDescAll", { amount })
      : text("certificateDescDefault", { amount });

  return { label, name, description };
}

// 金の縁・刻印・色づく街並み・通し番号。支援者証だけに足す。
function decorateFoundingSupporterCard(labelNode, nameNode) {
  finalCard.classList.toggle("is-founding-supporter", isFoundingSupporter);
  if (!isFoundingSupporter) {
    return;
  }

  labelNode.textContent = `✦ ${labelNode.textContent} ✦`;

  const edition = document.createElement("span");
  edition.className = "certificate-edition";
  edition.textContent = isEnglish() ? "CROWDFUNDING EDITION" : "クラウドファンディング支援者限定";
  labelNode.after(edition);

  const city = document.createElement("div");
  city.className = "certificate-city";
  city.setAttribute("aria-hidden", "true");
  CERTIFICATE_CITY_COLORS.forEach((color, index) => {
    const building = document.createElement("i");
    building.style.setProperty("--c", color);
    building.style.setProperty("--h", `${34 + ((index * 37) % 58)}%`);
    building.style.setProperty("--d", `${index * 0.18}s`);
    city.append(building);
  });
  nameNode.before(city);

  if (foundingSupporterComment) {
    const message = document.createElement("blockquote");
    message.className = "certificate-message";
    const messageLabel = document.createElement("span");
    messageLabel.textContent = isEnglish() ? "YOUR MESSAGE TO SHINJUKU" : "あなたが新宿に灯した言葉";
    const messageText = document.createElement("q");
    messageText.textContent = foundingSupporterComment;
    message.append(messageLabel, messageText);
    finalCard.append(message);
  }

  const serial = document.createElement("p");
  serial.className = "certificate-serial";
  serial.textContent = text("certificateSerial", { serial: foundingSupporterSerial });
  finalCard.append(serial);
}

function buildCrowdfundingTicketIssuer(content) {
  const issuer = document.createElement("section");
  issuer.className = "color-ticket-issuer";
  issuer.setAttribute(
    "aria-label",
    isEnglish() ? "Issuing your crowdfunding supporter certificate" : "クラウドファンディング支援者参加証を発行中",
  );

  const slot = document.createElement("div");
  slot.className = "color-ticket-slot";
  slot.setAttribute("aria-hidden", "true");
  const slotColors = document.createElement("i");
  slotColors.className = "color-ticket-slot-colors";
  slot.append(slotColors);

  const mask = document.createElement("div");
  mask.className = "color-ticket-mask";
  const travel = document.createElement("div");
  travel.className = "color-ticket-travel";
  const float = document.createElement("div");
  float.className = "color-ticket-float";
  const flip = document.createElement("div");
  flip.className = "color-ticket-flip";

  const back = document.createElement("div");
  back.className = "color-ticket-face color-ticket-back";
  const backMark = document.createElement("strong");
  backMark.textContent = "彩";
  const backCopy = document.createElement("span");
  backCopy.textContent = isEnglish() ? "CROWDFUNDING SUPPORTER" : "新宿へ託した応援";
  const backCity = document.createElement("small");
  backCity.textContent = "SHINJUKU DOOH";
  back.append(backMark, backCopy, backCity);

  const front = document.createElement("div");
  front.className = "color-ticket-face color-ticket-front crowdfunding-ticket-front";
  const reflex = document.createElement("i");
  reflex.className = "color-ticket-reflex";
  reflex.setAttribute("aria-hidden", "true");
  const header = document.createElement("header");
  const label = document.createElement("p");
  label.textContent = content.label;
  const barcode = document.createElement("i");
  barcode.className = "color-ticket-barcode";
  barcode.setAttribute("aria-hidden", "true");
  header.append(label, barcode);
  const name = document.createElement("h3");
  name.textContent = content.name;
  const edition = document.createElement("strong");
  edition.className = "color-ticket-amount";
  edition.textContent = isEnglish() ? "CROWDFUNDING EDITION" : "クラウドファンディング支援者限定";
  const message = document.createElement("p");
  message.className = "color-ticket-description crowdfunding-ticket-message";
  message.textContent = foundingSupporterComment
    ? `「${foundingSupporterComment}」`
    : content.description;
  const footer = document.createElement("footer");
  const serial = document.createElement("span");
  serial.textContent = foundingSupporterSerial
    ? text("certificateSerial", { serial: foundingSupporterSerial })
    : "FOUNDING SUPPORTER";
  const theme = document.createElement("span");
  theme.textContent = isEnglish() ? "COLOR RETURN PASS" : "モノクロから彩へ";
  footer.append(serial, theme);
  front.append(reflex, header, name, edition, message, footer);

  flip.append(back, front);
  float.append(flip);
  travel.append(float);
  mask.append(travel);
  issuer.append(slot, mask);
  return issuer;
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

  if (isFoundingSupporter) {
    finalCard.classList.remove("is-founding-supporter", "is-arriving");
    finalCard.classList.add("has-color-ticket", "is-crowdfunding-ticket");
    finalCard.append(buildCrowdfundingTicketIssuer(content));
  } else {
    finalCard.classList.remove("has-color-ticket", "is-crowdfunding-ticket", "is-issuing");
    finalCard.append(label, name, description);
    decorateFoundingSupporterCard(label, name);
  }
  ensureSupporterKeepsakeActions();

  const projectNote = document.createElement("section");
  projectNote.className = "project-note-card";
  const projectNoteLabel = document.createElement("span");
  projectNoteLabel.textContent = text("projectNoteLabel");
  const projectNoteText = document.createElement("p");
  projectNoteText.textContent = text("projectNoteText");
  const projectNoteLink = document.createElement("a");
  projectNoteLink.href = buildAboutUrl();
  projectNoteLink.textContent = text("projectNoteLink");
  projectNote.append(projectNoteLabel, projectNoteText, projectNoteLink);
  finalCard.append(projectNote);

  const dataFollowUp = document.createElement("section");
  dataFollowUp.className = "official-follow-up official-follow-up-data";
  const dataFollowUpLabel = document.createElement("span");
  dataFollowUpLabel.textContent = text("dataLabel");
  const dataFollowUpTitle = document.createElement("h4");
  dataFollowUpTitle.textContent = text("dataTitle");
  const dataFollowUpLink = document.createElement("a");
  dataFollowUpLink.href = "https://www.keishicho.metro.tokyo.lg.jp/about_mpd/jokyo_tokei/jokyo/ninchikensu.html";
  dataFollowUpLink.target = "_blank";
  dataFollowUpLink.rel = "noopener noreferrer";
  dataFollowUpLink.textContent = text("dataLink");
  const dataFollowUpNote = document.createElement("small");
  dataFollowUpNote.textContent = text("externalNote");
  dataFollowUp.append(dataFollowUpLabel, dataFollowUpTitle, dataFollowUpLink, dataFollowUpNote);
  finalCard.append(dataFollowUp);

  const supportChoice = supportChoiceDetailFor(selectedSupportChoiceId);
  if (!supportChoice) {
    return;
  }

  const followUp = document.createElement("section");
  followUp.className = "official-follow-up";
  const followUpLabel = document.createElement("span");
  followUpLabel.textContent = text("more");
  const followUpTitle = document.createElement("h4");
  followUpTitle.textContent = supportChoice.title;
  const followUpLink = document.createElement("a");
  followUpLink.href = supportChoice.url;
  followUpLink.target = "_blank";
  followUpLink.rel = "noopener noreferrer";
  followUpLink.textContent = `${supportChoice.linkLabel} ↗`;
  const followUpNote = document.createElement("small");
  followUpNote.textContent = text("externalNote");
  followUp.append(followUpLabel, followUpTitle, followUpLink, followUpNote);
  finalCard.append(followUp);
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
    swipeHint.textContent = text("storyThanks");
  }

  return true;
}

let ceremonyOverlay = null;
const ceremonyTimers = [];

function buildCeremonyOverlay() {
  if (ceremonyOverlay) {
    return ceremonyOverlay;
  }

  ceremonyOverlay = document.createElement("div");
  ceremonyOverlay.id = "supporterCeremony";
  ceremonyOverlay.setAttribute("aria-hidden", "true");

  const veil = document.createElement("div");
  veil.className = "ceremony-veil";

  const ceremonyCity = document.createElement("div");
  ceremonyCity.className = "ceremony-city";
  ceremonyCity.setAttribute("aria-hidden", "true");

  const converge = document.createElement("div");
  converge.className = "ceremony-converge";
  for (let index = 0; index < CEREMONY_RAY_COUNT; index += 1) {
    const ray = document.createElement("span");
    ray.className = "ceremony-ray";
    ray.style.setProperty("--angle", `${(360 / CEREMONY_RAY_COUNT) * index}deg`);
    ray.style.setProperty("--delay", `${index * 0.035}s`);
    ray.style.setProperty("--ray-color", CERTIFICATE_CITY_COLORS[index % CERTIFICATE_CITY_COLORS.length]);
    converge.append(ray);
  }

  ceremonyOverlay.append(veil, ceremonyCity, converge);

  for (let index = 0; index < CEREMONY_SPARK_COUNT; index += 1) {
    const spark = document.createElement("span");
    spark.className = "ceremony-spark";
    spark.style.setProperty("--x", `${(Math.random() - 0.5) * 320}px`);
    spark.style.setProperty("--y", `${60 + Math.random() * 420}px`);
    spark.style.setProperty("--delay", `${Math.random() * 0.5}s`);
    spark.style.setProperty("--spark-color", CERTIFICATE_CITY_COLORS[index % CERTIFICATE_CITY_COLORS.length]);
    ceremonyOverlay.append(spark);
  }

  document.body.append(ceremonyOverlay);
  return ceremonyOverlay;
}

function clearCeremonyTimers() {
  while (ceremonyTimers.length) {
    window.clearTimeout(ceremonyTimers.pop());
  }
}

function afterCeremonyBeat(delayMs, action) {
  ceremonyTimers.push(window.setTimeout(action, delayMs));
}

// 暗転 → 光が集束 → カードが降臨 → 金の粒。約3.4秒。
function playSupporterCeremony() {
  const overlay = buildCeremonyOverlay();
  clearCeremonyTimers();
  isCeremonyPlaying = true;
  overlay.classList.remove("is-converging", "is-lifting", "is-bursting");
  finalCard.classList.remove("is-issuing");
  void overlay.offsetWidth;
  overlay.classList.add("is-active");
  // 幕の裏を先に参加証へ切り替え、旧スワイプ画面の一瞬の露出を防ぐ。
  nextStep();

  afterCeremonyBeat(430, () => overlay.classList.add("is-converging"));

  afterCeremonyBeat(980, () => overlay.classList.add("is-bursting"));

  afterCeremonyBeat(2250, () => {
    finalCard.classList.add("is-issuing");
    overlay.classList.add("is-lifting");
  });

  afterCeremonyBeat(5000, () => {
    overlay.classList.remove("is-active", "is-converging", "is-lifting", "is-bursting");
    isCeremonyPlaying = false;
    // 演出中は見送っていたアンケート遷移を、ここから数え始める。
    scheduleFormRedirect();
  });
}

function finalizeCard() {
  if (!ensureSupportChoice()) {
    return false;
  }

  isFinalCardBuilt = false;
  buildFinalCard();
  if (isFoundingSupporter && !prefersReducedMotion) {
    playSupporterCeremony();
  } else {
    nextStep();
    if (isFoundingSupporter && finalCard.classList.contains("has-color-ticket")) {
      finalCard.classList.add("is-issuing");
    }
  }
  if (window.parent !== window) {
    window.parent.postMessage({
      type: "dooh-research-card-complete",
      participantCount,
      hasDisplayName: Boolean(nickname.value.trim()),
      displayName: nickname.value.trim().slice(0, 24),
      swipeEventId: completedSwipeEventId || "",
      swipeCount: completedSwipeCount || participantCount,
      isSupporter: isSupporterFlow,
      totalDays: isLiveShowcaseDemo ? 1 : completedParticipationVisit?.totalDays ?? 1,
      surveyUrl: (document.body?.dataset?.postFlowForm || "").trim(),
    }, location.origin);
  }

  return true;
}

// 寄付デモ完了後、公開に同意して入力された表示名だけをDOOHへ一度通知する。
let hasAnnouncedName = false;
let completedParticipationVisit = null;
async function announceDonorName() {
  if (hasAnnouncedName || !hasAcceptedParticipation) {
    return true;
  }

  const validation = await validateTypedDisplayName();
  if (!validation.ok) {
    return false;
  }

  const typed = validation.name;
  if (!typed) {
    return publishOptionalSupporterComment("");
  }

  const didPublishSupporterComment = await publishOptionalSupporterComment(typed);
  if (!didPublishSupporterComment) {
    return false;
  }

  // In debug/local replay, keep the saved name locally and avoid publishing to the live DOOH.
  if (isDebugReplay) {
    const debugAckDelayMs = Math.min(5000, Math.max(0, Number(new URLSearchParams(location.search).get("ackDelay")) || 0));
    if (debugAckDelayMs) await new Promise((resolve) => window.setTimeout(resolve, debugAckDelayMs));
    saveDisplayName(typed, { storageKey: participationStorageOptions.displayNameStorageKey });
    hasAnnouncedName = true;
    setInkLocationStatus(inkLocationCard, "sent", currentLanguage);
    return true;
  }

  const payload = {
    name: typed,
    channel: PARTICIPATION_CHANNEL,
    visitorId: completedParticipationVisit?.visitorId ?? null,
    isReturning: isLiveShowcaseDemo ? false : completedParticipationVisit?.isReturning === true,
    isSupporter: isSupporterFlow,
    isConsecutiveReturn: isLiveShowcaseDemo ? false : completedParticipationVisit?.isConsecutiveReturn === true,
    streakDays: isLiveShowcaseDemo ? 1 : completedParticipationVisit?.streakDays ?? 1,
    totalDays: isLiveShowcaseDemo ? 1 : completedParticipationVisit?.totalDays ?? 1,
    tickerFont: selectedTickerFont,
    swipeEventId: completedSwipeEventId || null,
    swipeCount: completedSwipeCount || null,
  };
  if (isAllExperience) {
    payload.source = "participant-flow-all";
  } else if (isMenExperience) {
    payload.source = "participant-flow-men";
  } else if (isSparkleExperience) {
    payload.source = "participant-flow-women";
  }

  const announcementResult = await publishNameAnnouncement(payload);
  if (
    announcementResult?.failed === true ||
    announcementResult?.fallback === true ||
    announcementResult?.blocked === true
  ) {
    setNicknameHelp(text("namePublishError"), "error");
    setInkLocationStatus(inkLocationCard, "error", currentLanguage);
    return false;
  }

  saveDisplayName(typed, { storageKey: participationStorageOptions.displayNameStorageKey });
  hasAnnouncedName = true;
  setNicknameHelp(NAME_LINKED_MESSAGE, "success");
  setInkLocationStatus(inkLocationCard, "sent", currentLanguage);
  return true;
}

function markAlreadyParticipatedToday(visit) {
  completedParticipationVisit = visit;
  hasCountedParticipation = true;
  hasAcceptedParticipation = false;
  hasAnnouncedName = true;
  swipeStep?.classList.add("is-participation-locked");
  swipeControl?.setAttribute("aria-disabled", "true");
  if (swipeHint) {
    swipeHint.textContent = text("alreadyHint");
  }
  if (thanksTitle) {
    thanksTitle.textContent = text("alreadyTitle");
  }
  if (window.parent !== window) {
    window.parent.postMessage({
      type: "dooh-research-already-participated",
      participantCount,
    }, location.origin);
  }
}

function applyYouTubeParticipationCopy() {
  if (!isYouTubeParticipation) {
    return;
  }

  document.body.classList.add("is-youtube-participation");
  document.body.removeAttribute("data-post-flow-form");

  const eyebrow = document.querySelector(".eyebrow");
  const lead = document.querySelector(".lead");
  const title = document.querySelector("#campaignTitle");
  const firstStepCopy = steps[0]?.querySelector("p");
  const stepCount = steps[0]?.querySelector(".step-count");

  if (eyebrow) eyebrow.textContent = text("youtubeEyebrow");
  if (title) title.innerHTML = text("youtubeTitle");
  if (lead) {
    lead.textContent = text("youtubeLead");
  }
  if (firstStepCopy) {
    firstStepCopy.textContent = text("youtubeCopy");
  }
  if (stepCount) {
    stepCount.textContent = "LIVE";
  }
  if (swipeHint) {
    swipeHint.textContent = text("youtubeSwipe");
  }
}

function clearYouTubeCooldownTimer() {
  if (youtubeCooldownTimer) {
    window.clearTimeout(youtubeCooldownTimer);
    youtubeCooldownTimer = null;
  }
}

function resetYouTubeParticipationForRetry() {
  if (!isYouTubeParticipation) {
    return;
  }

  clearYouTubeCooldownTimer();
  hasCountedParticipation = false;
  hasAcceptedParticipation = false;
  hasAnimatedCounter = false;
  isRegisteringParticipation = false;
  document.body.classList.remove("is-youtube-locked", "is-youtube-complete");
  swipeStep?.classList.remove("is-participation-locked");
  swipeControl?.removeAttribute("aria-disabled");
  updateSwipeCharge(0);
  applyYouTubeParticipationCopy();
}

function scheduleYouTubeRetryUnlock(state = getYouTubeCooldownState()) {
  if (!isYouTubeParticipation) {
    return;
  }

  clearYouTubeCooldownTimer();
  const delayMs = Math.max(0, Number(state.remainingMs) || 0);
  youtubeCooldownTimer = window.setTimeout(
    resetYouTubeParticipationForRetry,
    delayMs + 120,
  );
}

function markYouTubeCooldown(state = getYouTubeCooldownState()) {
  const remaining = formatCooldownTime(state.remainingMs);
  swipeStep?.classList.add("is-participation-locked");
  swipeControl?.setAttribute("aria-disabled", "true");
  document.body.classList.add("is-youtube-locked");

  const title = document.querySelector("#campaignTitle");
  const firstStepCopy = steps[0]?.querySelector("p");
  if (title) {
    title.innerHTML = text("youtubeLockedTitle");
  }
  if (firstStepCopy) {
    firstStepCopy.textContent = text("youtubeLockedCopy", { remaining });
  }
  if (swipeHint) {
    swipeHint.textContent = text("youtubeLockedHint", { remaining });
  }
  scheduleYouTubeRetryUnlock(state);
}

function showYouTubeCompletion() {
  document.body.classList.add("is-youtube-complete");
  swipeStep?.classList.add("is-participation-locked");
  swipeControl?.setAttribute("aria-disabled", "true");
  const cooldown = getYouTubeCooldownState();
  const remaining = formatCooldownTime(cooldown.remainingMs);

  const title = document.querySelector("#campaignTitle");
  const firstStepCopy = steps[0]?.querySelector("p");
  if (title) {
    title.innerHTML = text("youtubeDoneTitle");
  }
  if (firstStepCopy) {
    firstStepCopy.textContent = text("youtubeDoneCopy");
  }
  if (swipeHint) {
    swipeHint.textContent = text("youtubeDoneHint", { remaining });
  }
  scheduleYouTubeRetryUnlock(cooldown);
}

async function registerParticipation() {
  if (hasCountedParticipation) {
    return true;
  }
  if (isRegisteringParticipation) {
    return false;
  }

  if (isDebugReplay) {
    // debug: Firebase 送信も「今日は参加済み」ロックもせず、ローカルだけで完了扱いにする。
    // visitorId だけは本番と同じく確定させる（ランキングの自分の行を確認するため）。
    completedParticipationVisit = getParticipationVisit({
      today: participationDateOverride,
      storageKey: participationStorageOptions.storageKey,
    });
    participantCount += 1;
    completedSwipeEventId = `debug-${Date.now()}`;
    completedSwipeCount = participantCount;
    rememberSwipeLink(completedSwipeEventId, completedSwipeCount);
    updateCounterGoalProgress(participantCount);
    updateMilestonePreview(participantCount);
    hasCountedParticipation = true;
    hasAcceptedParticipation = true;
    hasAnimatedCounter = false;
    if (window.parent !== window) {
      window.parent.postMessage({
        type: "dooh-research-participation-complete",
        participantCount,
        swipeEventId: completedSwipeEventId,
        swipeCount: completedSwipeCount,
        isDemoReplay: true,
      }, location.origin);
    }
    return true;
  }

  isRegisteringParticipation = true;

  try {
    if (isYouTubeParticipation) {
      const cooldown = getYouTubeCooldownState();
      if (cooldown.blocked) {
        markYouTubeCooldown(cooldown);
        return false;
      }

      const payload = {
        name: RANDOM_GUEST_NAME,
        donationAmountYen: DEMO_DONATION_YEN,
        // YouTube Live は「同じ端末でも短い間隔で再参加OK」にする。
        // 通常参加と同じ visitorId / participationDate を送ると、1日1回制限により
        // 2回目以降が accepted:false になるため、サーバー側の日次重複判定には載せない。
        visitorId: null,
        participationDate: null,
        isReturning: false,
        isConsecutiveReturn: false,
        streakDays: 1,
        totalDays: 1,
        source: "participant-flow-youtube",
      };

      if (PARTICIPATION_CHANNEL !== "default") {
        payload.channel = PARTICIPATION_CHANNEL;
      }

      const result = await publishSwipeComplete(payload);
      if (result?.failed === true || result?.accepted === false) {
        if (swipeHint) {
          swipeHint.textContent = text("busy");
        }
        return false;
      }

      saveYouTubeParticipation(cooldown.visitorId);
      const committedCount = Number(result?.count);
      participantCount = Number.isFinite(committedCount)
        ? committedCount
        : participantCount + 1;
      completedSwipeEventId = String(result?.eventRef?.key ?? "");
      completedSwipeCount = participantCount;
      rememberSwipeLink(completedSwipeEventId, completedSwipeCount);
      updateCounterGoalProgress(participantCount);
      updateMilestonePreview(participantCount);
      hasCountedParticipation = true;
      hasAcceptedParticipation = true;
      hasAnimatedCounter = false;
      logAnalyticsEvent("youtube_swipe_complete", {
        channel: "youtube",
        experience: isMenExperience ? "men" : "women",
      });
      return true;
    }

    if (isLiveShowcaseDemo) {
      const result = await publishSwipeComplete({
        name: null,
        donationAmountYen: DEMO_DONATION_YEN,
        visitorId: null,
        participationDate: null,
        source: "showcase-smartphone-swipe",
      });
      if (result?.failed === true || result?.accepted === false) {
        if (swipeHint) swipeHint.textContent = text("busy");
        return false;
      }
      participantCount = Number.isFinite(Number(result?.count))
        ? Number(result.count)
        : participantCount + 1;
      completedParticipationVisit = {
        visitorId: null,
        isReturning: false,
        isConsecutiveReturn: false,
        streakDays: 1,
        totalDays: 1,
      };
      completedSwipeEventId = String(result?.eventRef?.key ?? "");
      completedSwipeCount = participantCount;
      rememberSwipeLink(completedSwipeEventId, completedSwipeCount);
      updateCounterGoalProgress(participantCount);
      updateMilestonePreview(participantCount);
      hasCountedParticipation = true;
      hasAcceptedParticipation = true;
      hasAnimatedCounter = false;
      window.parent.postMessage({
        type: "dooh-research-participation-complete",
        participantCount,
        swipeEventId: completedSwipeEventId,
        swipeCount: completedSwipeCount,
      }, location.origin);
      return true;
    }

    const visit = getParticipationVisit({
      today: participationDateOverride,
      storageKey: participationStorageOptions.storageKey,
    });
    if (visit.alreadyParticipatedToday) {
      markAlreadyParticipatedToday(visit);
      return true;
    }
    const payload = {
      // スワイプ時は匿名で即時反映し、参加証作成時に同じインクへ名前を後付けする。
      name: null,
      donationAmountYen: DEMO_DONATION_YEN,
      visitorId: visit.visitorId,
      participationDate: visit.participationDate,
      isReturning: visit.isReturning,
      isConsecutiveReturn: visit.isConsecutiveReturn,
      streakDays: visit.streakDays,
      totalDays: visit.totalDays,
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
        swipeHint.textContent = text("busy");
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
      totalDays: Math.max(1, Number(result?.event?.totalDays) || visit.totalDays || 1),
    };
    saveParticipationVisit(committedVisit, { storageKey: participationStorageOptions.storageKey });
    completedParticipationVisit = committedVisit;
    const committedCount = Number(result?.count);
    participantCount = Number.isFinite(committedCount)
      ? committedCount
      : participantCount + 1;
    completedSwipeEventId = String(result?.eventRef?.key ?? "");
    completedSwipeCount = participantCount;
    rememberSwipeLink(completedSwipeEventId, completedSwipeCount);
    updateCounterGoalProgress(participantCount);
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
    if (isYouTubeParticipation) {
      const cooldown = getYouTubeCooldownState();
      saveYouTubeParticipation(cooldown.visitorId);
      participantCount += 1;
      updateCounterGoalProgress(participantCount);
      updateMilestonePreview(participantCount);
      hasCountedParticipation = true;
      hasAcceptedParticipation = true;
      hasAnimatedCounter = false;
      logAnalyticsEvent("youtube_swipe_complete_local_fallback", {
        channel: "youtube",
        experience: isMenExperience ? "men" : "women",
      });
      return true;
    }
    if (swipeHint) {
      swipeHint.textContent = text("sendFailed");
    }
    return false;
  } finally {
    isRegisteringParticipation = false;
  }
}

async function markParticipationComplete() {
  const didComplete = await registerParticipation();
  if (didComplete) {
    syncInkLocationMap();
    if (isYouTubeParticipation) {
      showYouTubeCompletion();
      return true;
    }
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
    swipeHint.textContent = text("sending");
  }

  const didComplete = await markParticipationComplete();
  if (!didComplete) {
    updateSwipeCharge(84);
    if (swipeHint) {
      swipeHint.textContent = text("sendFailed");
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
  const url = location.hostname === "shinjuku-dooh-rs.web.app"
    ? new URL("https://shinjuku-dooh-rs.web.app/")
    : new URL("/", location.href);
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

function loadSupporterImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Supporter relight image failed to load."));
    image.src = source;
  });
}

function drawImageCover(ctx, image, x, y, width, height) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function supporterVideoFormat() {
  if (typeof MediaRecorder !== "function") {
    return null;
  }
  const candidates = [
    { mimeType: "video/mp4;codecs=avc1.42E01E", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];
  return candidates.find(({ mimeType }) => MediaRecorder.isTypeSupported?.(mimeType)) ?? null;
}

function drawSupporterVideoFrame(ctx, ceremonyImage, signatureImage, elapsedMs) {
  const width = SUPPORTER_VIDEO_WIDTH;
  const height = SUPPORTER_VIDEO_HEIGHT;
  const progress = Math.min(1, elapsedMs / SUPPORTER_VIDEO_DURATION_MS);
  const reveal = Math.min(1, Math.max(0, (progress - 0.06) / 0.25));
  const cardReveal = Math.min(1, Math.max(0, (progress - 0.27) / 0.2));
  const messageReveal = Math.min(1, Math.max(0, (progress - 0.48) / 0.16));

  const backdrop = ctx.createRadialGradient(810, 260, 20, 540, 820, 1200);
  backdrop.addColorStop(0, "#42240e");
  backdrop.addColorStop(0.32, "#181109");
  backdrop.addColorStop(1, "#050504");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = "#e8c37a";
  ctx.lineWidth = 2;
  for (let x = -height; x < width + height; x += 118) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (let index = 0; index < 54; index += 1) {
    const seed = ((index * 47) % 101) / 101;
    const travel = (progress * 1.45 + seed) % 1;
    const angle = index * 2.399;
    const radius = (1 - travel) * (520 + (index % 7) * 34);
    const x = width / 2 + Math.cos(angle) * radius;
    const y = 750 + Math.sin(angle) * radius * 0.78;
    ctx.globalAlpha = Math.sin(travel * Math.PI) * 0.72;
    const particleColorReveal = Math.min(1, Math.max(0, (progress - 0.22) / 0.28));
    ctx.fillStyle = particleColorReveal > 0.45
      ? CERTIFICATE_CITY_COLORS[index % CERTIFICATE_CITY_COLORS.length]
      : (index % 4 === 0 ? "#fff3d0" : "#e8c37a");
    ctx.beginPath();
    ctx.arc(x, y, 2 + (index % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#e8c37a";
  ctx.font = "700 28px ui-monospace, monospace";
  ctx.letterSpacing = "6px";
  ctx.fillText("SHINJUKU RELIGHT", 72, 102);
  ctx.fillStyle = "#fff3d0";
  ctx.font = "700 48px 'Noto Sans JP', sans-serif";
  ctx.letterSpacing = "0px";
  ctx.fillText(isEnglish() ? "Your support became the city's light." : "あなたの支援が、新宿の光になりました。", 72, 176);

  ctx.save();
  ctx.globalAlpha = reveal;
  drawRoundedRect(ctx, 62, 232, 956, 538, 34);
  ctx.clip();
  const colorReveal = Math.min(1, Math.max(0, (progress - 0.1) / 0.38));
  ctx.filter = `grayscale(${1 - colorReveal}) saturate(${0.72 + colorReveal * 0.5}) brightness(${0.68 + colorReveal * 0.32})`;
  drawImageCover(ctx, ceremonyImage, 62, 232, 956, 538);
  ctx.filter = "none";
  const cityShade = ctx.createLinearGradient(62, 232, 62, 770);
  cityShade.addColorStop(0, "rgba(0,0,0,0.04)");
  cityShade.addColorStop(1, "rgba(0,0,0,0.58)");
  ctx.fillStyle = cityShade;
  ctx.fillRect(62, 232, 956, 538);
  ctx.restore();
  ctx.strokeStyle = "rgba(232,195,122,0.62)";
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 62, 232, 956, 538, 34);
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = cardReveal;
  ctx.translate(0, (1 - cardReveal) * 80);
  drawRoundedRect(ctx, 62, 812, 956, 978, 40);
  ctx.fillStyle = "rgba(11,10,7,0.94)";
  ctx.fill();
  ctx.strokeStyle = "rgba(232,195,122,0.64)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.28;
  drawRoundedRect(ctx, 92, 995, 896, 250, 26);
  ctx.clip();
  drawImageCover(ctx, signatureImage, 92, 995, 896, 250);
  ctx.restore();

  ctx.fillStyle = "#e8c37a";
  ctx.font = "700 28px ui-monospace, monospace";
  ctx.letterSpacing = "7px";
  ctx.fillText("✦ FOUNDING SUPPORTER ✦", 112, 900);
  ctx.fillStyle = "rgba(232,195,122,0.12)";
  drawRoundedRect(ctx, 112, 928, 460, 50, 25);
  ctx.fill();
  ctx.strokeStyle = "rgba(232,195,122,0.42)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff3d0";
  ctx.font = "700 22px 'Noto Sans JP', sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText(isEnglish() ? "CROWDFUNDING EDITION" : "クラウドファンディング支援者限定", 138, 961);

  ctx.fillStyle = "#e8c37a";
  ctx.font = "700 76px 'Noto Sans JP', sans-serif";
  ctx.letterSpacing = "0px";
  drawWrappedText(ctx, getDisplayName(), 112, 1070, 850, 88, 2);
  ctx.fillStyle = "rgba(255,243,208,0.74)";
  ctx.font = "500 32px 'Noto Sans JP', sans-serif";
  drawWrappedText(ctx, isEnglish()
    ? "Your message will appear on the DOOH screen."
    : "応援コメントはDOOHに表示されます。", 112, 1170, 850, 50, 3);

  ctx.globalAlpha = messageReveal;
  drawRoundedRect(ctx, 108, 1310, 864, 260, 28);
  ctx.fillStyle = "rgba(232,195,122,0.07)";
  ctx.fill();
  ctx.strokeStyle = "rgba(232,195,122,0.42)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#e8c37a";
  ctx.font = "700 22px ui-monospace, monospace";
  ctx.letterSpacing = "3px";
  ctx.fillText(isEnglish() ? "YOUR MESSAGE TO SHINJUKU" : "あなたが新宿に灯した言葉", 146, 1372);
  ctx.fillStyle = "#fff3d0";
  ctx.font = "700 39px 'Noto Sans JP', sans-serif";
  ctx.letterSpacing = "0px";
  drawWrappedText(ctx, foundingSupporterComment, 146, 1448, 786, 58, 3);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(232,195,122,0.28)";
  ctx.beginPath();
  ctx.moveTo(112, 1620);
  ctx.lineTo(968, 1620);
  ctx.stroke();
  ctx.fillStyle = "#e8c37a";
  ctx.font = "700 25px ui-monospace, monospace";
  ctx.letterSpacing = "5px";
  ctx.fillText(`SERIAL No.${foundingSupporterSerial}`, 112, 1672);
  ctx.fillStyle = "rgba(255,243,208,0.65)";
  ctx.font = "500 25px 'Noto Sans JP', sans-serif";
  ctx.letterSpacing = "0px";
  ctx.fillText("SHINJUKU DOOH PROJECT", 112, 1740);
  ctx.restore();

  const fadeOut = Math.max(0, (progress - 0.96) / 0.04);
  if (fadeOut > 0) {
    ctx.globalAlpha = fadeOut;
    ctx.fillStyle = "#050504";
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}

async function createSupporterCeremonyVideo(button) {
  if (!isFoundingSupporter || isCreatingSupporterVideo) {
    return;
  }
  const format = supporterVideoFormat();
  if (!format || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
    if (shareStatus) {
      shareStatus.textContent = isEnglish()
        ? "Video export is not supported on this device. Replay the ceremony and use screen recording."
        : "この端末では動画保存に対応していません。演出を再生し、端末の画面収録をご利用ください。";
    }
    return;
  }

  isCreatingSupporterVideo = true;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.dataset.generating = "true";
  button.style.setProperty("--video-progress", "0%");
  button.setAttribute("role", "progressbar");
  button.setAttribute("aria-valuemin", "0");
  button.setAttribute("aria-valuemax", "100");
  button.setAttribute("aria-valuenow", "0");
  button.textContent = isEnglish() ? "Creating video… 8s left" : "演出動画を作成中… あと8秒";
  window.clearTimeout(formRedirectTimer);
  if (shareStatus) {
    shareStatus.textContent = isEnglish() ? "Creating your 8-second supporter movie…" : "8秒の支援者限定ムービーを作成しています…";
  }

  try {
    await document.fonts?.ready;
    const [ceremonyImage, signatureImage] = await Promise.all([
      loadSupporterImage(SUPPORTER_CEREMONY_IMAGE_URL),
      loadSupporterImage(SUPPORTER_SIGNATURE_IMAGE_URL),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = SUPPORTER_VIDEO_WIDTH;
    canvas.height = SUPPORTER_VIDEO_HEIGHT;
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(30);
    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      videoBitsPerSecond: 6_000_000,
    });
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = () => reject(recorder.error || new Error("Video recording failed."));
    });
    recorder.start(250);
    const startedAt = performance.now();
    await new Promise((resolve) => {
      const render = (now) => {
        const elapsed = Math.min(SUPPORTER_VIDEO_DURATION_MS, now - startedAt);
        drawSupporterVideoFrame(ctx, ceremonyImage, signatureImage, elapsed);
        const percent = Math.round((elapsed / SUPPORTER_VIDEO_DURATION_MS) * 100);
        const remainingSeconds = Math.max(0, Math.ceil((SUPPORTER_VIDEO_DURATION_MS - elapsed) / 1000));
        button.style.setProperty("--video-progress", `${percent}%`);
        button.setAttribute("aria-valuenow", String(percent));
        button.textContent = isEnglish()
          ? `Creating video… ${remainingSeconds}s left`
          : `演出動画を作成中… あと${remainingSeconds}秒`;
        if (elapsed >= SUPPORTER_VIDEO_DURATION_MS) {
          resolve();
          return;
        }
        requestAnimationFrame(render);
      };
      requestAnimationFrame(render);
    });
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: format.mimeType });
    if (!blob.size) {
      throw new Error("The generated video was empty.");
    }
    downloadBlob(blob, `shinjuku-founding-supporter.${format.extension}`);
    if (shareStatus) {
      shareStatus.textContent = isEnglish() ? "Your supporter movie is ready." : "支援者限定ムービーを保存しました。";
    }
    button.textContent = isEnglish() ? "Video saved" : "動画を保存しました";
  } catch (error) {
    console.warn("[supporter-video] export failed:", error);
    if (shareStatus) {
      shareStatus.textContent = isEnglish()
        ? "The video could not be created. Please replay the ceremony and use screen recording."
        : "動画を作成できませんでした。演出を再生し、端末の画面収録をご利用ください。";
    }
  } finally {
    isCreatingSupporterVideo = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.removeAttribute("role");
    button.removeAttribute("aria-valuemin");
    button.removeAttribute("aria-valuemax");
    button.removeAttribute("aria-valuenow");
    delete button.dataset.generating;
    button.style.removeProperty("--video-progress");
    window.setTimeout(() => {
      if (!isCreatingSupporterVideo) {
        button.textContent = isEnglish() ? "Save ceremony video" : "演出動画を保存";
      }
    }, 1800);
  }
}

function ensureSupporterKeepsakeActions() {
  const shareButton = document.getElementById("shareBtn");
  const actions = shareButton?.closest(".actions");
  if (!actions) {
    return;
  }
  let replayButton = document.getElementById("replaySupporterCeremonyBtn");
  let videoButton = document.getElementById("saveSupporterVideoBtn");
  if (!replayButton) {
    replayButton = document.createElement("button");
    replayButton.type = "button";
    replayButton.id = "replaySupporterCeremonyBtn";
    replayButton.className = "ghost supporter-keepsake-action";
    replayButton.dataset.supporterKeepsake = "1";
    replayButton.addEventListener("click", () => {
      window.clearTimeout(formRedirectTimer);
      playSupporterCeremony();
    });
    actions.insertBefore(replayButton, shareButton);
  }
  if (!videoButton) {
    videoButton = document.createElement("button");
    videoButton.type = "button";
    videoButton.id = "saveSupporterVideoBtn";
    videoButton.className = "primary supporter-keepsake-action";
    videoButton.dataset.supporterKeepsake = "1";
    videoButton.addEventListener("click", () => createSupporterCeremonyVideo(videoButton));
    actions.insertBefore(videoButton, shareButton);
  }
  replayButton.hidden = !isFoundingSupporter;
  videoButton.hidden = !isFoundingSupporter;
  replayButton.textContent = isEnglish() ? "Replay the ceremony" : "豪華演出をもう一度見る";
  videoButton.textContent = isEnglish() ? "Save ceremony video" : "演出動画を保存";
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

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back for in-app browsers or stricter clipboard permissions.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
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
    if (isYouTubeParticipation) {
      return (isDebugReplay || !getYouTubeCooldownState().blocked) && swipeChargeValue >= 100;
    }
    return (isDebugReplay || !pendingParticipationVisit.alreadyParticipatedToday) && swipeChargeValue >= 100;
  }
  if (index === 2) {
    return true;
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
  const isParticipationBlocked = isLiveShowcaseDemo
    ? false
    : isYouTubeParticipation
      ? getYouTubeCooldownState().blocked
      : pendingParticipationVisit.alreadyParticipatedToday;
  if ((!isDebugReplay && isParticipationBlocked) || hasCountedParticipation) {
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
  if (!event.target.closest("[data-swipe-control]")) {
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

stepBackButton?.addEventListener("click", previousStep);

// 表示名を参加証プレビューへ即時反映。日本語IMEの変換中(composition)でも更新されるよう
// input だけでなく composition 系イベントも拾う（一部の端末は input が確定まで走らないため）。
const syncPreviewName = () => {
  previewName.textContent = getDisplayName();
  const typed = nickname.value.trim();
  if (typed && isInappropriateName(typed)) {
    setNicknameHelp(NAME_BLOCKED_MESSAGE, "error");
    nickname.setAttribute("aria-invalid", "true");
    return;
  }
  nickname.removeAttribute("aria-invalid");
  restoreNicknameHelp();
};

function applyShowcaseDemoName(preferredName = "") {
  if (!isLiveShowcaseDemo) return;
  const currentName = nickname.value.trim();
  const displayName = String(preferredName || currentName || SHOWCASE_DEMO_NAMES[
    Math.floor(Math.random() * SHOWCASE_DEMO_NAMES.length)
  ]).trim().slice(0, 20);
  if (!displayName || isInappropriateName(displayName)) return;
  nickname.value = displayName;
  nickname.dispatchEvent(new Event("input", { bubbles: true }));
  if (createCardButton) {
    createCardButton.disabled = false;
    createCardButton.setAttribute("aria-busy", "false");
  }
}

function syncSupporterCommentInput() {
  if (!supporterPasscode || !supporterComment) {
    return;
  }
  const input = getSupporterCommentInput();
  if (supporterPasscode.value !== input.code) {
    supporterPasscode.value = input.code;
  }
  if (!input.code && !input.comment) {
    restoreSupporterCommentHelp();
  } else if (input.comment && isInappropriateName(input.comment)) {
    setSupporterCommentHelp(SUPPORTER_COMMENT_ERROR, "error");
  } else {
    restoreSupporterCommentHelp();
  }
}

nickname.addEventListener("input", syncPreviewName);
nickname.addEventListener("compositionupdate", syncPreviewName);
nickname.addEventListener("compositionend", syncPreviewName);
setupSupporterDemoCodeButton();
supporterPasscode?.addEventListener("input", syncSupporterCommentInput);
supporterComment?.addEventListener("input", syncSupporterCommentInput);

async function resolveSavedNameChoice() {
  const localSavedName = getSavedDisplayName({
    storageKey: participationStorageOptions.displayNameStorageKey,
  });
  if (localSavedName) {
    return localSavedName;
  }

  if (!pendingParticipationVisit.isReturning || !pendingParticipationVisit.visitorId) {
    return "";
  }

  try {
    const latestName = await getLatestNameAnnouncementForVisitor(pendingParticipationVisit.visitorId, {
      channel: PARTICIPATION_CHANNEL,
    });
    const remoteSavedName = String(latestName?.name ?? "").trim().slice(0, 20);
    if (remoteSavedName && !isInappropriateName(remoteSavedName)) {
      saveDisplayName(remoteSavedName, {
        storageKey: participationStorageOptions.displayNameStorageKey,
      });
      return remoteSavedName;
    }
  } catch (error) {
    console.info("[participant] saved name fallback unavailable:", error);
  }

  return "";
}

async function setupSavedNameChoice() {
  const savedName = await resolveSavedNameChoice();
  const nameField = nickname.closest(".sparkle-name-field") ?? nickname;
  const nameStep = nickname.closest(".step");
  if (!savedName || !nameStep) {
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

if (!isYouTubeParticipation) {
  setupSavedNameChoice();
}

async function submitDisplayName() {
  applyShowcaseDemoName();
  const defaultCreateLabel = createCardButton.textContent;
  if (isLiveShowcaseDemo) createCardButton.textContent = text("sending");
  setNameChecking(true);
  try {
    const ackStartedAt = performance.now();
    const canCreate = await announceDonorName();
    if (!canCreate) {
      return false;
    }
    if (nickname.value.trim()) {
      logAnalyticsEvent("name_announcement_ack", {
        ackAt: Date.now(),
        ackDurationMs: Math.round(performance.now() - ackStartedAt),
      });
      const guidanceTimeoutMs = isDebugReplay
        ? Math.max(100, Number(new URLSearchParams(location.search).get("guidanceTimeout")) || 30_000)
        : 30_000;
      doohGazePrompt?.show({
        timeoutMs: guidanceTimeoutMs,
        onQuietExit: () => logAnalyticsEvent("name_guidance_quiet_exit", { timeoutMs: guidanceTimeoutMs }),
      });
    }
    finalizeCard();
    return true;
  } finally {
    setNameChecking(false);
    createCardButton.textContent = defaultCreateLabel;
  }
}
createCardButton?.addEventListener("click", submitDisplayName);
// 表示名を出さない支援者でも、パスコードを入れていれば認証して支援者証を出す。
skipNameButton?.addEventListener("click", async () => {
  const { code, comment } = getSupporterCommentInput();
  if (!code && !comment) {
    finalizeCard();
    return;
  }

  setNameChecking(true);
  try {
    if (!await publishOptionalSupporterComment("")) {
      return;
    }
    finalizeCard();
  } finally {
    setNameChecking(false);
  }
});

supportChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const detail = supportChoiceDetailFor(button.dataset.supportChoice);
    if (!detail || !supportChoiceDetail) {
      return;
    }

    supportChoiceButtons.forEach((option) => {
      option.setAttribute("aria-pressed", String(option === button));
    });
    selectedSupportChoiceId = button.dataset.supportChoice;
    setSupportColor(selectedSupportChoiceId);
    supportChoiceDetail.replaceChildren();
    const title = document.createElement("h4");
    title.textContent = detail.title;
    const description = document.createElement("p");
    description.textContent = detail.description;
    const note = document.createElement("small");
    note.className = "support-choice-complete-note";
    note.textContent = text("detailAfterCard");
    supportChoiceDetail.classList.remove("is-visible");
    supportChoiceDetail.append(title, description, note);
    supportChoiceDetail.hidden = false;
    requestAnimationFrame(() => {
      supportChoiceDetail.classList.add("is-visible");
    });
    if (window.parent !== window) {
      window.parent.postMessage({
        type: "dooh-research-support-choice",
        supportChoice: button.dataset.supportChoice,
      }, location.origin);
    }
  });
});

tickerFontButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSelectedTickerFont(button.dataset.tickerFont);
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
applyYouTubeParticipationCopy();
restoreSelectedTickerFont();
ensureLanguageToggle();
applyLanguage();

if (isYouTubeParticipation && !isDebugReplay) {
  logAnalyticsEvent("youtube_page_open", {
    channel: "youtube",
    experience: isMenExperience ? "men" : "women",
  });
}

const shouldResumeSupporterAfterSwipe =
  isSupporterFlow &&
  new URLSearchParams(window.location.search).get("entry") === "swiped";

function consumeSupporterResumeParam() {
  if (!shouldResumeSupporterAfterSwipe || typeof history?.replaceState !== "function") {
    return;
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("entry");
    history.replaceState(history.state, "", url.toString());
  } catch {
    // URL cleanup only controls refresh behavior; the flow can continue without it.
  }
}

// debug（host/ローカル）では「今日は参加済み」ロックを無視して、毎回スワイプから試せるようにする。
if (!isDebugReplay && isYouTubeParticipation && getYouTubeCooldownState().blocked) {
  markYouTubeCooldown();
} else if (
  !isDebugReplay &&
  !isLiveShowcaseDemo &&
  !isYouTubeParticipation &&
  pendingParticipationVisit.alreadyParticipatedToday &&
  !shouldResumeSupporterAfterSwipe
) {
  markAlreadyParticipatedToday(pendingParticipationVisit);
}
mountDebugReplayButton();
showStep(0);
// 合体導線: 通常ページでスワイプ→「クラファン支援者版」から遷移してきた場合は、
// スワイプをやり直させず「参加証に名前を残す」の先頭から始める（直接アクセス時は従来どおりスワイプから）。
if (
  shouldResumeSupporterAfterSwipe
) {
  // 入口ページでスワイプ済み。参加済み状態を引き継がないと announceDonorName が
  // 早期returnし、名前つき作成でコード検証＝支援者版参加証・演出が丸ごと飛ばされる。
  hasAcceptedParticipation = true;
  // The swipe was counted on the standard route before this navigation.
  // Carry only the local display state; do not publish or increment again.
  hasCountedParticipation = true;
  hasAnnouncedName = false;
  if (!completedParticipationVisit) {
    completedParticipationVisit = getParticipationVisit({
      today: participationDateOverride,
      storageKey: participationStorageOptions.storageKey,
    });
  }
  setSupporterCertificateIntent(true);
  // ステップ先頭の見出し「参加証に名前を残す」が見える位置で止める（自動スクロールしない）
  showStep(2);
  consumeSupporterResumeParam();
}
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

// Returning from the separate supporter route can restore this page from the
// back-forward cache while the roll-up animation is still showing its initial
// zero. Paint the known value immediately, then confirm it with Firebase.
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) {
    return;
  }

  if (currentStep === 1 && hasCountedParticipation) {
    restoreParticipantCounterImmediately();
  }

  getParticipantCount({ channel: PARTICIPATION_CHANNEL })
    .then((count) => {
      syncParticipantCount(count, {
        preserveLocal: hasCountedParticipation,
        forceCounter: true,
      });
      if (currentStep === 1 && hasCountedParticipation) {
        restoreParticipantCounterImmediately();
      }
    })
    .catch((error) => {
      console.warn("[firebase] participant count restore failed:", error);
    });
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
