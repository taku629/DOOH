import { publishParticipationEvent } from "./participation-bridge.js";

const CONFIG_PATH = new URL("../config/firebase-config.json", import.meta.url).href;
const PARTICIPATION_PATH = "participation";
const PARTICIPATION_V2_PATH = "participationV2";
const PARTICIPATION_MORNING_PATH = "participationMorning";
const DISPLAY_CONFIG_PATH = "displayConfig";

let configPromise;
let firebaseSdkPromise;
let firebaseFunctionsSdkPromise;
let appPromise;
let databasePromise;
let functionsPromise;

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

async function loadFirebaseFunctionsSdk() {
    if (firebaseFunctionsSdkPromise) {
        return firebaseFunctionsSdkPromise;
    }

    firebaseFunctionsSdkPromise = import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js")
        .catch((error) => {
            console.warn("[firebase] Functions SDK load failed; local fallback enabled:", error);
            return null;
        });

    return firebaseFunctionsSdkPromise;
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

async function ensureFunctions() {
    if (functionsPromise) {
        return functionsPromise;
    }

    functionsPromise = (async () => {
        const app = await ensureApp();
        if (!app) {
            return null;
        }

        const functionsSdk = await loadFirebaseFunctionsSdk();
        if (!functionsSdk) {
            return null;
        }

        return functionsSdk.getFunctions(app, "asia-southeast1");
    })();

    return functionsPromise;
}

function createClientEventId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
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
    const channel = normalizeChannel(payload.channel);
    const functions = await ensureFunctions();

    if (!functions) {
        return publishLocalSwipeComplete(payload);
    }

    const functionsSdk = await loadFirebaseFunctionsSdk();
    if (!functionsSdk) {
        return publishLocalSwipeComplete(payload);
    }

    try {
        const submitSwipeComplete = functionsSdk.httpsCallable(functions, "submitSwipeComplete");
        const result = await submitSwipeComplete({
            channel,
            source: payload.source ?? channel,
            name: payload.name ?? null,
            donationAmountYen: Number(payload.donationAmountYen) || 100,
            clientEventId: payload.clientEventId || createClientEventId(),
            returnCount: false,
        });
        const eventId = result.data?.eventId || null;
        return {
            count: Number(result.data?.count) || null,
            duplicate: Boolean(result.data?.duplicate),
            eventRef: eventId ? { key: eventId } : null,
        };
    } catch (error) {
        console.warn("[functions] swipe publish failed; local fallback enabled:", error);
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
