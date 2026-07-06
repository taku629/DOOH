import { getDonationMilestoneGoal } from "../src/condition-manager.js";
import { getLatestNameAnnouncementForVisitor, getParticipantCount, getSupporterComments, publishNameAnnouncement, publishSupporterComment, publishSwipeComplete, subscribeToParticipantCount } from "../src/firebase-bridge.js?v=20260626-youtube-channel-1";
import { logAnalyticsEvent } from "../src/analytics-bridge.js?v=20260626-youtube-analytics-1";
import { triggerCompletionHaptic, triggerProgressHaptic } from "../src/haptic.js";
import { isInappropriateName } from "../src/name-filter.js";
import { moderateDisplayName } from "../src/name-moderation.js?v=20260619-ai-1";
import { getDemoSupporterPasscodes, verifySupporterPasscode } from "../src/supporter-passcodes.js?v=20260623-demo-code-1";
import { clearParticipationVisit, getParticipationVisit, saveParticipationVisit } from "../src/returning-participant.mjs?v=20260614-4";
import { clearSavedDisplayName, getSavedDisplayName, saveDisplayName } from "../src/saved-display-name.mjs?v=20260614-2";
import { getChannelForTheme, resolveTheme } from "../src/theme-router.js";

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
const NAME_CHECKING_MESSAGE = "\u8868\u793a\u540d\u3092\u78ba\u8a8d\u3057\u3066\u3044\u307e\u3059...";
const NAME_BLOCKED_MESSAGE = "\u3053\u306e\u8868\u793a\u540d\u306f\u516c\u958b\u3067\u304d\u307e\u305b\u3093\u3002\u5225\u306e\u30cb\u30c3\u30af\u30cd\u30fc\u30e0\u306b\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
const SUPPORTER_CHECKING_MESSAGE = "\u30af\u30e9\u30d5\u30a1\u30f3\u652f\u63f4\u8005\u30b3\u30e1\u30f3\u30c8\u3092\u78ba\u8a8d\u3057\u3066\u3044\u307e\u3059...";
const SUPPORTER_PASSCODE_ERROR = "4\u6841\u306e\u30d1\u30b9\u30b3\u30fc\u30c9\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
const SUPPORTER_COMMENT_ERROR = "\u3053\u306e\u30b3\u30e1\u30f3\u30c8\u306f\u8868\u793a\u3067\u304d\u307e\u305b\u3093\u3002\u8868\u73fe\u3092\u5909\u3048\u3066\u304f\u3060\u3055\u3044\u3002";
const SUPPORTER_COMMENT_SAVED = "\u30b3\u30e1\u30f3\u30c8\u3092DOOH\u306b\u5c4a\u3051\u307e\u3057\u305f\u3002";
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
const VISUAL_CHANGE_INTERVAL = 9;
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

const DEMO_DONATION_YEN = 100;
const MONTHLY_PARTICIPANT_GOAL = 3000;
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
    description: "駅・駅前広場・駅ビルを一体的に整備する、新宿グランドターミナルの取り組みを確認できます。",
    linkLabel: "新宿駅直近地区の取り組みを見る",
    url: "https://www.city.shinjuku.lg.jp/kusei/toshikei01_000001_00018.html",
  },
  graffiti: {
    title: "歩きやすい街へ",
    description: "人が憩い、楽しく歩ける都市空間を目指す、西新宿地区の再整備を確認できます。",
    linkLabel: "西新宿地区の取り組みを見る",
    url: "https://www.city.shinjuku.lg.jp/kusei/toshikei01_000001_00048.html",
  },
  outreach: {
    title: "地域活性化",
    description: "文化の創造・発信と賑わいづくりを進める、歌舞伎町ルネッサンスの取り組みを確認できます。",
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
    supportTitle: "応援したい取り組みを見る",
    supportLead: "任意です。タップすると取り組みの概要を確認できます。",
    supportAria: "応援したい取り組み",
    detail: "詳しく見る",
    supportNote: "※このデモでは寄付は実行されません。",
    trendKicker: "新宿の治安のいま",
    trendTitle: "犯罪件数は減少傾向",
    trendBody: "一方で、不安感はまだ残っています。",
    trendStat: "刑法犯認知件数：2009年 10,968件 → 2024年 6,025件",
    trendNote: "出典：警視庁公開データ。詳細は参加証作成後に確認できます。",
    displayNameLabel: "表示名（任意）",
    nameTab: "ここに入力",
    nicknamePlaceholder: "例：さくら",
    nicknameHelp: "入力した名前は参加証とDOOHに数秒間表示されます。\n本名でなくニックネームを入力してください。",
    fontLegend: "名前の見た目を選ぶ",
    fontHelp: "好きな見た目を選べます",
    supporterKicker: "クラファン支援者の方へ",
    supporterTitle: "DOOHに一言コメントを表示",
    supporterLead: "4桁のパスコードを入力して\n新宿への応援コメントをしましょう！",
    passcode: "パスコード",
    comment: "一言コメント",
    commentPlaceholder: "例：新宿が、誰かの居場所であり続けますように",
    supporterHelp: "入力は任意です。URLや個人情報は表示できません。",
    createCard: "この名前で作成",
    skipName: "名前なしで作成",
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
    sendFailed: "通信に失敗しました。もう一度上までスワイプしてください。",
    sending: "応援アクションを反映しています。",
    busy: "通信が混み合っています。少し時間をおいてもう一度お試しください。",
    alreadyHint: "本日はすでに参加済みです。また明日の参加をお待ちしています。",
    alreadyTitle: "本日は参加済みです",
    certificateLabelAll: "新宿みんなのアクション証",
    certificateLabelDefault: "SHINJUKU COLOR SUPPORTER",
    certificateDescMorning: "この参加は無料です。集まったお金から、朝の新宿を応援する支援先へ¥{amount}を届けます。",
    certificateDescAll: "この参加は無料です。集まったお金から、誰もが過ごしやすい新宿を支える支援先へ¥{amount}を届けます。",
    certificateDescDefault: "この参加は無料です。集まったお金から、新宿を応援する支援先へ¥{amount}を届けます。",
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
    nicknameHelp: "Your name may appear on the certificate and DOOH screen for a few seconds.\nPlease use a nickname, not your real name.",
    fontLegend: "Choose name style",
    fontHelp: "Pick the look you like",
    supporterKicker: "For crowdfunding supporters",
    supporterTitle: "Show a short message on DOOH",
    supporterLead: "Enter a 4-digit passcode\nand leave a message for Shinjuku!",
    passcode: "Passcode",
    comment: "Short message",
    commentPlaceholder: "e.g. May Shinjuku stay welcoming for everyone",
    supporterHelp: "Optional. URLs and personal information cannot be shown.",
    createCard: "Create with this name",
    skipName: "Create without a name",
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
    sendFailed: "Connection failed. Please swipe all the way up again.",
    sending: "Sending your support action…",
    busy: "The connection is busy. Please wait a moment and try again.",
    alreadyHint: "You have already joined today. Please come back tomorrow.",
    alreadyTitle: "Already joined today",
    certificateLabelAll: "SHINJUKU ACTION CERTIFICATE",
    certificateLabelDefault: "SHINJUKU COLOR SUPPORTER",
    certificateDescMorning: "This action is free. Sponsored funds will send ¥{amount} to a morning Shinjuku support destination.",
    certificateDescAll: "This action is free. Sponsored funds will send ¥{amount} to a destination that supports a more welcoming Shinjuku.",
    certificateDescDefault: "This action is free. Sponsored funds will send ¥{amount} to a support destination for Shinjuku.",
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
let hasShownSwipeReadyEffect = false;
let hasAnimatedCounter = false;
let isFinalCardBuilt = false;
let selectedSupportChoiceId = null;
let selectedTickerFont = "noto";
let isRegisteringParticipation = false;
let isAutoCompletingSwipe = false;
let swipeChargeValue = 0;
let counterAnimationFrame = null;
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
  button.textContent = "デモ用コードを自動入力";
  button.addEventListener("click", () => {
    chooseAvailableDemoSupporterCode(button);
  });
  field.appendChild(button);
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
  document.body.classList.toggle("has-color-participation", index >= 1);
  app.classList.toggle("is-share-ready", index === totalSteps - 1);
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
    window.setTimeout(() => animateCounter(participantCount), delay);
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
  // debug: 外部アンケートに飛ばさず、最初のスワイプ画面に戻して文言を見直せるようにする。
  if (isDebugReplay) {
    formRedirectTimer = window.setTimeout(() => {
      formRedirectTimer = null;
      resetFlowForDebug();
    }, 4000);
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

  const lead = Number(document.body?.dataset?.postFlowLead) || 1800;
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

  const startValue = 0;
  const duration = 1900;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const value = Math.floor(startValue + (target - startValue) * eased);
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
  }

  counterAnimationFrame = requestAnimationFrame(tick);
}

function nextStep() {
  if (currentStep < totalSteps - 1) {
    showStep(currentStep + 1);
  }
}

function previousStep() {
  if (currentStep > 1 && currentStep < totalSteps - 1) {
    showStep(currentStep - 1);
  }
}

function ensureSupportChoice() {
  return true;
}

function getCertificateContent() {
  const name = getDisplayName();
  const label = activeTheme === "morning"
    ? "SHINJUKU MORNING SUPPORTER"
    : isAllExperience
      ? text("certificateLabelAll")
    : isMenExperience
      ? "CERTIFICATE OF SUPPORT"
    : isSparkleExperience
      ? "CERTIFICATE OF SUPPORT"
      : text("certificateLabelDefault");

  const amount = DEMO_DONATION_YEN.toLocaleString(isEnglish() ? "en-US" : "ja-JP");
  const description = activeTheme === "morning"
    ? text("certificateDescMorning", { amount })
    : isAllExperience
      ? text("certificateDescAll", { amount })
      : text("certificateDescDefault", { amount });

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

function finalizeCard() {
  if (!ensureSupportChoice()) {
    return false;
  }

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
    saveDisplayName(typed, { storageKey: participationStorageOptions.displayNameStorageKey });
    hasAnnouncedName = true;
    return true;
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
    totalDays: completedParticipationVisit?.totalDays ?? 1,
    tickerFont: selectedTickerFont,
  };
  if (isAllExperience) {
    payload.source = "participant-flow-all";
  } else if (isMenExperience) {
    payload.source = "participant-flow-men";
  } else if (isSparkleExperience) {
    payload.source = "participant-flow-women";
  }

  publishNameAnnouncement(payload).catch(() => {});
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
    participantCount += 1;
    updateCounterGoalProgress(participantCount);
    updateMilestonePreview(participantCount);
    hasCountedParticipation = true;
    hasAcceptedParticipation = true;
    hasAnimatedCounter = false;
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
  const isParticipationBlocked = isYouTubeParticipation
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

createCardButton?.addEventListener("click", async () => {
  setNameChecking(true);
  try {
    const canCreate = await announceDonorName();
    if (!canCreate) {
      return;
    }
    finalizeCard();
  } finally {
    setNameChecking(false);
  }
});
skipNameButton?.addEventListener("click", () => {
  finalizeCard();
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
// debug（host/ローカル）では「今日は参加済み」ロックを無視して、毎回スワイプから試せるようにする。
if (!isDebugReplay && isYouTubeParticipation && getYouTubeCooldownState().blocked) {
  markYouTubeCooldown();
} else if (!isDebugReplay && !isYouTubeParticipation && pendingParticipationVisit.alreadyParticipatedToday) {
  markAlreadyParticipatedToday(pendingParticipationVisit);
}
mountDebugReplayButton();
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
