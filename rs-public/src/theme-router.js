const VALID_THEMES = new Set(["day", "night", "morning"]);

export function getTimeTheme(now = new Date()) {
    const hour = now.getHours();

    return hour >= 7 && hour <= 10 ? "morning" : "day";
}

export function resolveTheme(options = {}) {
    const defaultTheme = options.defaultTheme || "day";
    const search = options.search ?? (typeof location !== "undefined" ? location.search : "");
    const pathname = options.pathname ?? (typeof location !== "undefined" ? location.pathname : "");
    const params = new URLSearchParams(search);
    const requestedTheme = params.get("theme");

    if (requestedTheme === "auto") {
        return getTimeTheme(options.now || new Date());
    }

    if (VALID_THEMES.has(requestedTheme)) {
        return requestedTheme;
    }

    if (/(^|\/)(v3|participant-v3)$/.test(pathname)) {
        return "morning";
    }

    return defaultTheme;
}

export function getChannelForTheme(theme, defaultChannel = "default") {
    return theme === "morning" ? "morning" : defaultChannel;
}

export function buildThemeUrl(path, theme) {
    const url = new URL(path, typeof location !== "undefined" ? location.origin : "https://dooh-ca9c2.web.app");

    if (theme === "morning") {
        url.searchParams.set("theme", "morning");
    }

    return url.href;
}
