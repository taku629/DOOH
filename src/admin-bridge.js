import {
    getApp,
    getApps,
    initializeApp,
} from "firebase/app";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth";
import {
    getDatabase,
    onValue,
    ref,
    serverTimestamp,
    set,
    update,
} from "firebase/database";

const CONFIG_PATH = "/config/firebase-config.json";
const DISPLAY_CONFIG_PATH = "displayConfig";
const PARTICIPATION_PATH = "participation";
const PARTICIPATION_V2_PATH = "participationV2";
const PARTICIPATION_MORNING_PATH = "participationMorning";

let configPromise;
let appPromise;
let authPromise;
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

function getLastCelebratedCountPath(channel) {
    return `${getParticipationPath(channel)}/lastCelebratedCount`;
}

function getDisplayConfigPath(channel) {
    return `${DISPLAY_CONFIG_PATH}/${normalizeChannel(channel)}`;
}

async function loadConfig() {
    if (configPromise) {
        return configPromise;
    }

    configPromise = (async () => {
        const response = await fetch(CONFIG_PATH, { cache: "no-cache" });
        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (!data.apiKey || !data.databaseURL || /REPLACE_ME|EXAMPLE/i.test(JSON.stringify(data))) {
            return null;
        }

        return data;
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

async function ensureAuth() {
    if (authPromise) {
        return authPromise;
    }

    authPromise = (async () => {
        const app = await ensureApp();
        return app ? getAuth(app) : null;
    })();

    return authPromise;
}

async function ensureDatabase() {
    if (databasePromise) {
        return databasePromise;
    }

    databasePromise = (async () => {
        const app = await ensureApp();
        return app ? getDatabase(app) : null;
    })();

    return databasePromise;
}

async function requireAdminContext() {
    const database = await ensureDatabase();
    const auth = await ensureAuth();
    if (!database || !auth) {
        throw new Error("Firebase is not configured.");
    }
    if (!auth.currentUser) {
        throw new Error("Admin sign-in is required.");
    }

    return { auth, database };
}

export async function publishDisplayPlaylist(playlist, options = {}) {
    const { auth, database } = await requireAdminContext();
    const channel = normalizeChannel(options.channel);

    await set(ref(database, getDisplayConfigPath(channel)), {
        playlist,
        updatedAt: serverTimestamp(),
        updatedBy: {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email || null,
        },
    });
}

export async function resetParticipantCount(options = {}) {
    const { database } = await requireAdminContext();
    const channel = normalizeChannel(options.channel);

    await update(ref(database), {
        [getParticipantCountPath(channel)]: 0,
        [getLastCelebratedCountPath(channel)]: 0,
    });
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

export async function signInAdmin(email, password) {
    const auth = await ensureAuth();
    if (!auth) {
        throw new Error("Firebase Auth is not configured.");
    }

    return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutAdmin() {
    const auth = await ensureAuth();
    if (!auth) {
        return;
    }

    await signOut(auth);
}

export async function subscribeToAdminAuth(callback) {
    const auth = await ensureAuth();
    if (!auth) {
        callback(null);
        return () => {};
    }

    return onAuthStateChanged(auth, callback);
}
