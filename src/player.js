import { playFallback } from "./fallback-handler.js";
import { subscribeToSwipeCompletes } from "./firebase-bridge.js";
import { logError, logPlayback } from "./logger.js";
import { subscribeToParticipationEvents } from "./participation-bridge.js";
import { getCurrentVideo } from "./scheduler.js";

const player = document.querySelector("#player");
const displayShell = document.querySelector("#displayShell");
const fallbackView = document.querySelector("#videoFallback");
const participationTakeover = document.querySelector("#participationTakeover");
const participationSignal = document.querySelector("#participationSignal");
const participantCount = document.querySelector("#displayParticipantCount");
const participantStatus = document.querySelector("#displayParticipantStatus");
const takeoverParticipantName = document.querySelector("#takeoverParticipantName");
const playlistPath = "./config/playlist.json";

let playlist;
let normalVideoPath;
let participationTimer;
let displayCount = 0;
let usingFallbackVideo = false;

function showFallbackView(visible) {
    if (!fallbackView) {
        return;
    }

    fallbackView.hidden = !visible;
}

function updateParticipationStatus(event) {
    displayCount += 1;

    if (participantCount) {
        participantCount.textContent = String(displayCount);
    }

    if (participantStatus) {
        participantStatus.textContent = `${event.name} さんが参加しました`;
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
            participantStatus.textContent = "スマホ参加を待機中";
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

function handleRemoteSessionStart(event) {
    handleParticipation({
        name: event?.name || "リモート参加者",
    });
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
        subscribeToSwipeCompletes((event) => handleParticipation({ name: event?.name || "参加者" })).catch(logError);
    } catch (error) {
        showFallbackView(true);
        logError(error);
    }
}

startPlayer();
