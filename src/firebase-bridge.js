import {
    initializeApp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    get,
    getDatabase,
    onChildAdded,
    onValue,
    push,
    ref,
    runTransaction,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const CONFIG_PATH = new URL("../config/firebase-config.json", import.meta.url).href;
const SWIPES_PATH = "swipes";
const PARTICIPANT_COUNT_PATH = "stats/participantCount";

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

export async function publishSwipeComplete(payload = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return null;
    }

    const countRef = ref(database, PARTICIPANT_COUNT_PATH);
    const countResult = await runTransaction(countRef, (currentValue) => {
        const currentCount = Number(currentValue) || 0;
        return currentCount + 1;
    });
    if (!countResult.committed) {
        throw new Error("Participant count transaction was not committed.");
    }
    const participantCount = Number(countResult.snapshot.val()) || 0;

    const swipesRef = ref(database, SWIPES_PATH);
    const eventRef = await push(swipesRef, {
        type: "swipe-completed",
        createdAt: serverTimestamp(),
        count: participantCount,
        name: payload.name ?? null,
        userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
    });

    return {
        count: participantCount,
        eventRef,
    };
}

export async function getParticipantCount() {
    const database = await ensureDatabase();
    if (!database) {
        return null;
    }

    const snapshot = await get(ref(database, PARTICIPANT_COUNT_PATH));
    return Number(snapshot.val()) || 0;
}

export async function subscribeToParticipantCount(callback) {
    const database = await ensureDatabase();
    if (!database) {
        return () => {};
    }

    return onValue(ref(database, PARTICIPANT_COUNT_PATH), (snapshot) => {
        callback(Number(snapshot.val()) || 0);
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
