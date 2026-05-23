import { publishParticipationEvent } from "./participation-bridge.js";
import { buildParticipationTransactionValue } from "./participation-transaction.mjs";

const CONFIG_PATH = new URL("../config/firebase-config.json", import.meta.url).href;
const PARTICIPATION_PATH = "participation";
const PARTICIPATION_V2_PATH = "participationV2";
const PARTICIPATION_MORNING_PATH = "participationMorning";
const DISPLAY_CONFIG_PATH = "displayConfig";

let configPromise;
let firebaseSdkPromise;
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

async function loadFirebaseSdk() {
    if (firebaseSdkPromise) {
        return firebaseSdkPromise;
    }

    firebaseSdkPromise = Promise.all([
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"),
    ])
        .then(([appSdk, databaseSdk]) => ({ ...appSdk, ...databaseSdk }))
        .catch((error) => {
            console.warn("[firebase] SDK load failed; local fallback enabled:", error);
            return null;
        });

    return firebaseSdkPromise;
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
        const sdk = await loadFirebaseSdk();
        if (!sdk) {
            return null;
        }

        if (sdk.getApps().length > 0) {
            return sdk.getApp();
        }

        return sdk.initializeApp(config);
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
        const sdk = await loadFirebaseSdk();
        if (!sdk) {
            return null;
        }
        return sdk.getDatabase(app);
    })();

    return databasePromise;
}

function publishLocalSwipeComplete(payload = {}) {
    const channel = normalizeChannel(payload.channel);
    const event = publishParticipationEvent({
        ...payload,
        channel,
        source: payload.source ?? channel,
        type: "swipe-completed",
    });

    return {
        count: null,
        event,
        eventRef: null,
        fallback: true,
    };
}

export async function publishSwipeComplete(payload = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return publishLocalSwipeComplete(payload);
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return publishLocalSwipeComplete(payload);
    }

    const channel = normalizeChannel(payload.channel);

    try {
        const eventRef = sdk.push(sdk.ref(database, getSwipesPath(channel)));
        if (!eventRef.key) {
            throw new Error("Swipe event key could not be generated.");
        }
        const event = {
            key: eventRef.key,
            createdAt: sdk.serverTimestamp(),
            source: payload.source ?? channel,
            name: payload.name ?? null,
            donationAmountYen: Number(payload.donationAmountYen) || null,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        };

        const participationRef = sdk.ref(database, getParticipationPath(channel));
        const result = await sdk.runTransaction(participationRef, (currentValue) => {
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
    } catch (error) {
        console.warn("[firebase] swipe publish failed; local fallback enabled:", error);
        return publishLocalSwipeComplete(payload);
    }
}

export async function getParticipantCount(options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return null;
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return null;
    }

    const channel = normalizeChannel(options.channel);
    const snapshot = await sdk.get(sdk.ref(database, getParticipantCountPath(channel)));
    return Number(snapshot.val()) || 0;
}

export async function subscribeToParticipantCount(callback, options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return () => {};
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return () => {};
    }

    const channel = normalizeChannel(options.channel);
    return sdk.onValue(sdk.ref(database, getParticipantCountPath(channel)), (snapshot) => {
        callback(Number(snapshot.val()) || 0);
    });
}

export async function subscribeToSwipeCompletes(callback, options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return () => {};
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return () => {};
    }

    const channel = normalizeChannel(options.channel);
    const swipesRef = sdk.ref(database, getSwipesPath(channel));
    const knownIds = new Set();

    try {
        const snapshot = await sdk.get(swipesRef);
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                knownIds.add(child.key);
            });
        }
    } catch (error) {
        console.warn("[firebase] initial swipes fetch failed:", error);
    }

    return sdk.onChildAdded(swipesRef, (snap) => {
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
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return () => {};
    }

    const channel = normalizeChannel(options.channel);
    return sdk.onValue(sdk.ref(database, getDisplayConfigPath(channel)), (snapshot) => {
        callback(snapshot.val() || null);
    });
}
