import { playFallback } from "./fallback-handler.js";
import { logError, logPlayback } from "./logger.js";
import { subscribeToParticipationEvents } from "./participation-bridge.js";
import { getCurrentVideo } from "./scheduler.js";

const player = document.querySelector("#player");
const fallbackView = document.querySelector("#videoFallback");
const participationSignal = document.querySelector("#participationSignal");
const participantCount = document.querySelector("#displayParticipantCount");
const participantStatus = document.querySelector("#displayParticipantStatus");
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
    updateParticipationStatus(event);

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
}

startPlayer();
