import { playFallback } from "./fallback-handler.js";
import { subscribeToParticipantCount, subscribeToSwipeCompletes } from "./firebase-bridge.js";
import { logError, logPlayback } from "./logger.js";
import { subscribeToParticipationEvents } from "./participation-bridge.js";
import { getCurrentVideo } from "./scheduler.js";

const player = document.querySelector("#player");
const displayShell = document.querySelector("#displayShell");
const fallbackView = document.querySelector("#videoFallback");
const participationTakeover = document.querySelector("#participationTakeover");
const participationSignal = document.querySelector("#participationSignal");
const donationTotal = document.querySelector("#displayDonationTotal");
const participantCount = document.querySelector("#displayParticipantCount");
const participantStatus = document.querySelector("#displayParticipantStatus");
const takeoverParticipantName = document.querySelector("#takeoverParticipantName");
const participationChannel = displayShell?.dataset.participationChannel || "default";
const playlistPath = "./config/playlist.json";
const DEMO_DONATION_YEN = 100;

let playlist;
let normalVideoPath;
let participationTimer;
let displayCount = 0;
let usingFallbackVideo = false;
let displayedCount = 0;
let totalAnimationFrame = null;
let hasInitializedLiveTotals = false;

function formatDonationTotal(count) {
    return `¥${(count * DEMO_DONATION_YEN).toLocaleString("ja-JP")}`;
}

function setLiveTotals(count) {
    displayedCount = count;

    if (donationTotal) {
        donationTotal.textContent = formatDonationTotal(count);
    }

    if (participantCount) {
        participantCount.textContent = count.toLocaleString("ja-JP");
    }
}

function updateLiveTotals(count, options = {}) {
    const target = Math.max(0, Number(count) || 0);
    const shouldAnimate = options.animate && target !== displayedCount;

    if (!shouldAnimate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        if (totalAnimationFrame) {
            cancelAnimationFrame(totalAnimationFrame);
            totalAnimationFrame = null;
        }
        setLiveTotals(target);
        return;
    }

    if (totalAnimationFrame) {
        cancelAnimationFrame(totalAnimationFrame);
    }

    const start = displayedCount;
    const duration = 1200;
    const startTime = performance.now();

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const value = Math.round(start + (target - start) * eased);

        setLiveTotals(value);

        if (progress < 1) {
            totalAnimationFrame = requestAnimationFrame(tick);
            return;
        }

        totalAnimationFrame = null;
        setLiveTotals(target);
    }

    totalAnimationFrame = requestAnimationFrame(tick);
}

function showFallbackView(visible) {
    if (!fallbackView) {
        return;
    }

    fallbackView.hidden = !visible;
}

function updateParticipationStatus(event) {
    const eventCount = Number(event?.count);
    displayCount = Number.isFinite(eventCount) ? eventCount : displayCount + 1;

    updateLiveTotals(displayCount, { animate: true });

    if (participantStatus) {
        const donationAmount = Number(event?.donationAmountYen) || DEMO_DONATION_YEN;
        participantStatus.textContent = `${event.name} さんが¥${donationAmount.toLocaleString("ja-JP")}デモ募金しました`;
    }

    participationSignal?.classList.add("is-active");
}

function showParticipationTakeover(visible, event) {
    displayShell?.classList.toggle("is-participation-playing", visible);

    if (participationTakeover) {
        participationTakeover.hidden = !visible;
    }

    if (visible && takeoverParticipantName) {
        takeoverParticipantName.textContent = event?.name || "匿名サポーター";
    }
}

async function loadPlaylist() {
    const response = await fetch(playlistPath);

    if (!response.ok) {
        throw new Error(`Failed to load playlist: ${response.status}`);
    }

    return response.json();
}

async function playVideo(videoPath) {
    usingFallbackVideo = false;
    player.src = videoPath;
    await player.play();
    logPlayback(videoPath);
}

function scheduleReturnToNormal() {
    clearTimeout(participationTimer);

    const returnDelay = (playlist.participationReturnSeconds || 8) * 1000;
    participationTimer = setTimeout(() => {
        showParticipationTakeover(false);

        if (normalVideoPath) {
            playVideo(normalVideoPath).catch(logError);
        }

        participationSignal?.classList.remove("is-active");

        if (participantStatus) {
            participantStatus.textContent = "スマホからのデモ募金を待機中";
        }
    }, returnDelay);
}

function handleParticipation(event) {
    if (displayShell?.classList.contains("is-participation-playing")) {
        return;
    }

    updateParticipationStatus(event);
    showParticipationTakeover(true, event);

    if (playlist.participationVideo) {
        playVideo(playlist.participationVideo)
            .catch(logError)
            .finally(scheduleReturnToNormal);
        return;
    }

    scheduleReturnToNormal();
}

async function startPlayer() {
    if (!player) {
        throw new Error("Video player element was not found.");
    }

    try {
        playlist = await loadPlaylist();
        normalVideoPath = getCurrentVideo(playlist);

        player.addEventListener("playing", () => showFallbackView(false), { once: true });
        player.addEventListener("error", () => {
            if (usingFallbackVideo) {
                showFallbackView(true);
                logError(new Error("Fallback video failed to load."));
                return;
            }

            showFallbackView(true);
            usingFallbackVideo = true;
            playFallback(player, playlist.fallback);
        });

        await playVideo(normalVideoPath);
        subscribeToParticipationEvents(handleParticipation);
    } catch (error) {
        showFallbackView(true);
        logError(error);
    }

    subscribeToParticipantCount((count) => {
        const shouldAnimate = hasInitializedLiveTotals && count > displayedCount;
        hasInitializedLiveTotals = true;
        displayCount = count;
        updateLiveTotals(displayCount, { animate: shouldAnimate });
    }, { channel: participationChannel }).catch(logError);
    subscribeToSwipeCompletes((event) => handleParticipation({
        count: event?.count,
        name: event?.name || "参加者",
        donationAmountYen: event?.donationAmountYen,
    }), { channel: participationChannel }).catch(logError);
}

startPlayer();
