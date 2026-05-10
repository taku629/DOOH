export function getCurrentVideo(playlist) {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    const matchedRules = playlist.rules.find((rule) => {
        return currentTime >= rule.start && currentTime <= rule.end;
    });

    if (matchedRules) {
        return matchedRules.video;
    }

    return playlist.fallback;
}
