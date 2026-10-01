export function playFallback(player, fallbackVideo) {
    console.warn("Fallback video is playing");

    player.src = fallbackVideo;

    player.play().catch((error) => {
        console.error("Fallback playback failed:", error);
    });
}
