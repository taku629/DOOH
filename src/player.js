import { playFallback } from "./fallback-handler.js";
import { logError, logPlayback } from "./logger.js";
import { getCurrentVideo } from "./scheduler.js";

const player = document.querySelector("#player");
const fallbackView = document.querySelector("#videoFallback");
const playlistPath = "./config/playlist.json";

function showFallbackView(visible) {
    if (!fallbackView) {
        return;
    }

    fallbackView.hidden = !visible;
}

async function loadPlaylist() {
    const response = await fetch(playlistPath);

    if (!response.ok) {
        throw new Error(`Failed to load playlist: ${response.status}`);
    }

    return response.json();
}

async function startPlayer() {
    if (!player) {
        throw new Error("Video player element was not found.");
    }

    try {
        const playlist = await loadPlaylist();
        const videoPath = getCurrentVideo(playlist);

        player.src = videoPath;
        player.addEventListener("playing", () => showFallbackView(false), { once: true });
        player.addEventListener("error", () => {
            showFallbackView(true);
            playFallback(player, playlist.fallback);
        });

        await player.play();
        logPlayback(videoPath);
    } catch (error) {
        showFallbackView(true);
        logError(error);
    }
}

startPlayer();
