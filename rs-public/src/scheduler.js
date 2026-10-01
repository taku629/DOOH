function isTimeInRange(currentTime, start, end) {
    if (!start || !end) {
        return false;
    }

    if (start <= end) {
        return currentTime >= start && currentTime <= end;
    }

    return currentTime >= start || currentTime <= end;
}

export function getCurrentVideo(playlist, now = new Date()) {
    const currentTime = now.toTimeString().slice(0, 5);
    const rules = Array.isArray(playlist?.rules) ? playlist.rules : [];

    const matchedRule = rules.find((rule) => {
        return isTimeInRange(currentTime, rule.start, rule.end);
    });

    if (matchedRule?.video) {
        return matchedRule.video;
    }

    return playlist?.fallback;
}
