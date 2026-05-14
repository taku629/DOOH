import {
    initializeApp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    get,
    getDatabase,
    onChildAdded,
    push,
    ref,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const CONFIG_PATH = new URL("../config/firebase-config.json", import.meta.url).href;
const SESSIONS_PATH = "sessions";
const SWIPES_PATH = "swipes";

let configPromise;
let databasePromise;

async function loadConfig() {
    if (configPromise) {
        return configPromise;
    }

    configPromise = (async () => {
        try {
            const response = await fetch(CONFIG_PATH, { cache: "no-cache" });
            if (!response.ok) {
                console.info("[firebase] config file not found; cross-device sync disabled");
                return null;
            }
            const data = await response.json();
            if (!data.apiKey || !data.databaseURL || /REPLACE_ME|EXAMPLE/i.test(JSON.stringify(data))) {
                console.info("[firebase] config has placeholder values; cross-device sync disabled");
                return null;
            }
            return data;
        } catch (error) {
            console.warn("[firebase] config load failed:", error);
            return null;
        }
    })();

    return configPromise;
}

async function ensureDatabase() {
    if (databasePromise) {
        return databasePromise;
    }

    databasePromise = (async () => {
        const config = await loadConfig();
        if (!config) {
            return null;
        }
        const app = initializeApp(config);
        return getDatabase(app);
    })();

    return databasePromise;
}

export async function publishSessionStart(payload = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return null;
    }

    const sessionsRef = ref(database, SESSIONS_PATH);
    return push(sessionsRef, {
        type: "session-started",
        createdAt: serverTimestamp(),
        screenId: payload.screenId ?? null,
        name: payload.name ?? null,
        userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
}

export async function publishSwipeComplete(payload = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return null;
    }

    const swipesRef = ref(database, SWIPES_PATH);
    return push(swipesRef, {
        type: "swipe-completed",
        createdAt: serverTimestamp(),
        name: payload.name ?? null,
        userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
}

export async function subscribeToSwipeCompletes(callback) {
    const database = await ensureDatabase();
    if (!database) {
        return () => {};
    }

    const swipesRef = ref(database, SWIPES_PATH);
    const knownIds = new Set();

    try {
        const snapshot = await get(swipesRef);
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                knownIds.add(child.key);
            });
        }
    } catch (error) {
        console.warn("[firebase] initial swipes fetch failed:", error);
    }

    return onChildAdded(swipesRef, (snap) => {
        if (knownIds.has(snap.key)) {
            return;
        }
        knownIds.add(snap.key);

        const data = snap.val();
        if (!data || data.type !== "swipe-completed") {
            return;
        }

        callback({ id: snap.key, ...data });
    });
}

export async function subscribeToSessionStarts(callback) {
    const database = await ensureDatabase();
    if (!database) {
        return () => {};
    }

    const sessionsRef = ref(database, SESSIONS_PATH);
    const knownIds = new Set();

    try {
        const snapshot = await get(sessionsRef);
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                knownIds.add(child.key);
            });
        }
    } catch (error) {
        console.warn("[firebase] initial sessions fetch failed:", error);
    }

    return onChildAdded(sessionsRef, (snap) => {
        if (knownIds.has(snap.key)) {
            return;
        }
        knownIds.add(snap.key);

        const data = snap.val();
        if (!data || data.type !== "session-started") {
            return;
        }

        callback({ id: snap.key, ...data });
    });
}
