import {
    getApp,
    getApps,
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
import { buildParticipationTransactionValue } from "./participation-transaction.mjs";

const CONFIG_PATH = new URL("../config/firebase-config.json", import.meta.url).href;
const PARTICIPATION_PATH = "participation";
const PARTICIPATION_V2_PATH = "participationV2";
const PARTICIPATION_MORNING_PATH = "participationMorning";
const DISPLAY_CONFIG_PATH = "displayConfig";

let configPromise;
let appPromise;
let databasePromise;

function normalizeChannel(channel = "default") {
    return channel === "v2" || channel === "morning" ? channel : "default";
}

function getParticipationPath(channel = "default") {
    const normalizedChannel = normalizeChannel(channel);

    if (normalizedChannel === "v2") {
        return PARTICIPATION_V2_PATH;
    }

    if (normalizedChannel === "morning") {
        return PARTICIPATION_MORNING_PATH;
    }

    return PARTICIPATION_PATH;
}

function getParticipantCountPath(channel) {
    return `${getParticipationPath(channel)}/participantCount`;
}

function getSwipesPath(channel) {
    return `${getParticipationPath(channel)}/swipes`;
}

function getDisplayConfigPath(channel) {
    return `${DISPLAY_CONFIG_PATH}/${normalizeChannel(channel)}`;
}

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

async function ensureApp() {
    if (appPromise) {
        return appPromise;
    }

    appPromise = (async () => {
        const config = await loadConfig();
        if (!config) {
            return null;
        }

        if (getApps().length > 0) {
            return getApp();
        }

        return initializeApp(config);
    })();

    return appPromise;
}

async function ensureDatabase() {
    if (databasePromise) {
        return databasePromise;
    }

    databasePromise = (async () => {
        const app = await ensureApp();
        if (!app) {
            return null;
        }
        return getDatabase(app);
    })();

    return databasePromise;
}

export async function publishSwipeComplete(payload = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return null;
    }

    const channel = normalizeChannel(payload.channel);
    const eventRef = push(ref(database, getSwipesPath(channel)));
    if (!eventRef.key) {
        throw new Error("Swipe event key could not be generated.");
    }
    const event = {
        key: eventRef.key,
        createdAt: serverTimestamp(),
        source: payload.source ?? channel,
        name: payload.name ?? null,
        donationAmountYen: Number(payload.donationAmountYen) || null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    };

    const participationRef = ref(database, getParticipationPath(channel));
    const result = await runTransaction(participationRef, (currentValue) => {
        return buildParticipationTransactionValue(currentValue, event);
    });
    if (!result.committed) {
        throw new Error("Participation transaction was not committed.");
    }
    const committedData = result.snapshot.val() || {};
    const participantCount = Number(committedData.participantCount) || 0;

    return {
        count: participantCount,
        eventRef,
    };
}

export async function getParticipantCount(options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return null;
    }

    const channel = normalizeChannel(options.channel);
    const snapshot = await get(ref(database, getParticipantCountPath(channel)));
    return Number(snapshot.val()) || 0;
}

export async function subscribeToParticipantCount(callback, options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return () => {};
    }

    const channel = normalizeChannel(options.channel);
    return onValue(ref(database, getParticipantCountPath(channel)), (snapshot) => {
        callback(Number(snapshot.val()) || 0);
    });
}

export async function subscribeToSwipeCompletes(callback, options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return () => {};
    }

    const channel = normalizeChannel(options.channel);
    const swipesRef = ref(database, getSwipesPath(channel));
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

export async function subscribeToDisplayConfig(callback, options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return () => {};
    }

    const channel = normalizeChannel(options.channel);
    return onValue(ref(database, getDisplayConfigPath(channel)), (snapshot) => {
        callback(snapshot.val() || null);
    });
}
