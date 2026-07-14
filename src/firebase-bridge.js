import { computeVisitStats } from "./participation-transaction.mjs";
import { isInappropriateName } from "./name-filter.js";

const CONFIG_PATH = new URL("../config/firebase-config.json", import.meta.url).href;
const PARTICIPATION_PATH = "participation";
const PARTICIPATION_V2_PATH = "participationV2";
const PARTICIPATION_MORNING_PATH = "participationMorning";
const PARTICIPATION_RESEARCH_PATH = "participationResearch";
const PARTICIPATION_YOUTUBE_PATH = "participationYouTube";
const DISPLAY_CONFIG_PATH = "displayConfig";
const NAME_SHOUTS_PATH = "nameShouts";
const SUPPORTER_COMMENTS_PATH = "supporterComments";
const WRITE_RETRY_DELAYS_MS = [0, 400, 1000];
const TICKER_FONT_IDS = new Set(["noto", "rounded", "mincho", "dot", "yusei"]);

function normalizeTickerFont(value) {
    return TICKER_FONT_IDS.has(value) ? value : "noto";
}

let configPromise;
let firebaseSdkPromise;
let appPromise;
let databasePromise;

function normalizeChannel(channel = "default") {
    return channel === "v2" || channel === "morning" || channel === "research" || channel === "youtube"
        ? channel
        : "default";
}

function getParticipationPath(channel = "default") {
    const normalizedChannel = normalizeChannel(channel);

    if (normalizedChannel === "v2") {
        return PARTICIPATION_V2_PATH;
    }

    if (normalizedChannel === "morning") {
        return PARTICIPATION_MORNING_PATH;
    }

    if (normalizedChannel === "research") {
        return PARTICIPATION_RESEARCH_PATH;
    }

    if (normalizedChannel === "youtube") {
        return PARTICIPATION_YOUTUBE_PATH;
    }

    return PARTICIPATION_PATH;
}

function getParticipantCountPath(channel) {
    return `${getParticipationPath(channel)}/participantCount`;
}

function getLastCelebratedCountPath(channel) {
    return `${getParticipationPath(channel)}/lastCelebratedCount`;
}

function getSwipesPath(channel) {
    return `${getParticipationPath(channel)}/swipes`;
}

function getParticipantHistoryPath(channel) {
    return `${getParticipationPath(channel)}/participantHistory`;
}

function getDisplayConfigPath(channel) {
    return `${DISPLAY_CONFIG_PATH}/${normalizeChannel(channel)}`;
}

function getNameShoutsPath(channel) {
    return `${NAME_SHOUTS_PATH}/${normalizeChannel(channel)}`;
}

function getSupporterCommentsPath(channel) {
    return `${SUPPORTER_COMMENTS_PATH}/${normalizeChannel(channel)}`;
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

async function getParticipantCountFromRest(channel) {
    const config = await loadConfig();
    if (!config?.databaseURL) {
        return null;
    }

    const databaseUrl = String(config.databaseURL).replace(/\/$/, "");
    const path = getParticipantCountPath(channel)
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    const response = await fetch(`${databaseUrl}/${path}.json`, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`participant count REST fetch failed: ${response.status}`);
    }
    return Number(await response.json()) || 0;
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

function normalizePositiveDayCount(...values) {
    for (const value of values) {
        const number = Number(value);
        if (Number.isFinite(number) && number > 0) {
            return Math.max(1, Math.floor(number));
        }
    }
    return 1;
}

function enrichAnnouncementWithParticipantHistory(announcement, participantHistory = {}) {
    const visitorId = typeof announcement?.visitorId === "string" ? announcement.visitorId : "";
    const history = visitorId ? participantHistory[visitorId] : null;
    if (!history || typeof history !== "object") {
        return announcement;
    }

    const announcementTotalDays = normalizePositiveDayCount(announcement.totalDays, announcement.streakDays);
    const historyTotalDays = normalizePositiveDayCount(history.totalDays, history.streakDays);
    const totalDays = Math.max(announcementTotalDays, historyTotalDays);
    const streakDays = Math.max(
        normalizePositiveDayCount(announcement.streakDays),
        normalizePositiveDayCount(history.streakDays)
    );

    return {
        ...announcement,
        isReturning: announcement.isReturning === true || totalDays >= 2,
        streakDays,
        totalDays,
    };
}

function createFailedSwipeResult(error) {
    return {
        count: null,
        event: null,
        eventRef: null,
        accepted: false,
        failed: true,
        retryable: true,
        error,
    };
}

function wait(delayMs) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function publishSwipeComplete(payload = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return createFailedSwipeResult(new Error("Firebase database is unavailable."));
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return createFailedSwipeResult(new Error("Firebase SDK is unavailable."));
    }

    const channel = normalizeChannel(payload.channel);
    const candidateName = typeof payload.name === "string" ? payload.name.trim().slice(0, 24) : null;
    const eventRef = sdk.push(sdk.ref(database, getSwipesPath(channel)));
    if (!eventRef.key) {
        return createFailedSwipeResult(new Error("Swipe event key could not be generated."));
    }

    const visitorId = typeof payload.visitorId === "string" && payload.visitorId ? payload.visitorId : null;
    const participationDate =
        typeof payload.participationDate === "string" && payload.participationDate
            ? payload.participationDate
            : null;
    const dailyPath = visitorId && participationDate
        ? `${getParticipationPath(channel)}/dailyParticipants/${participationDate}/${visitorId}`
        : null;

    const readParticipantCount = async () => {
        try {
            const snapshot = await sdk.get(sdk.ref(database, getParticipantCountPath(channel)));
            return Number(snapshot.val()) || 0;
        } catch {
            return null;
        }
    };

    // 訪問履歴と同日重複だけを先に読む（visitorId単位なので他の参加者と競合しない）
    let previousVisit = null;
    if (visitorId) {
        try {
            const [historySnapshot, dailySnapshot] = await Promise.all([
                sdk.get(sdk.ref(database, `${getParticipantHistoryPath(channel)}/${visitorId}`)),
                dailyPath ? sdk.get(sdk.ref(database, dailyPath)) : Promise.resolve(null),
            ]);
            if (dailySnapshot?.exists()) {
                return { count: await readParticipantCount(), eventRef, event: null, accepted: false, failed: false };
            }
            previousVisit = historySnapshot.val();
        } catch (error) {
            console.warn("[firebase] participant history read failed:", error);
        }
    }

    const stats = computeVisitStats(previousVisit, participationDate);
    const event = {
        type: "swipe-completed",
        createdAt: sdk.serverTimestamp(),
        source: payload.source ?? channel,
        name: candidateName && !isInappropriateName(candidateName) ? candidateName : null,
        donationAmountYen: Number(payload.donationAmountYen) || null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        visitorId,
        participationDate,
        isReturning: stats.isReturning,
        isConsecutiveReturn: stats.isConsecutiveReturn,
        streakDays: stats.streakDays,
        totalDays: stats.totalDays,
        tickerFont: normalizeTickerFont(payload.tickerFont),
    };

    // participantCountはincrement(1)のサーバー側加算に任せ、swipe本体と同一の
    // 多パスupdateで原子的に書く。親ノードtransactionと違い他参加者とのCAS競合が起きない。
    const updates = {
        [getParticipantCountPath(channel)]: sdk.increment(1),
        [`${getSwipesPath(channel)}/${eventRef.key}`]: event,
    };
    if (dailyPath) {
        updates[dailyPath] = sdk.serverTimestamp();
        updates[`${getParticipantHistoryPath(channel)}/${visitorId}`] = {
            lastParticipationDate: participationDate,
            streakDays: stats.streakDays,
            totalDays: stats.totalDays,
        };
    }

    let lastError = null;
    for (const delayMs of WRITE_RETRY_DELAYS_MS) {
        if (delayMs > 0) {
            await wait(delayMs);
        }

        try {
            await sdk.update(sdk.ref(database), updates);
            return { count: await readParticipantCount(), eventRef, event, accepted: true, failed: false };
        } catch (error) {
            lastError = error;
            console.warn("[firebase] swipe publish attempt failed:", error);
            if (/permission.denied/i.test(String(error?.code ?? "") + String(error?.message ?? ""))) {
                // rules拒否は再試行しても変わらない。同日重複がrulesで原子的に
                // 弾かれた場合は「本日参加済み」として扱う。
                if (dailyPath) {
                    try {
                        const dailySnapshot = await sdk.get(sdk.ref(database, dailyPath));
                        if (dailySnapshot.exists()) {
                            return { count: await readParticipantCount(), eventRef, event: null, accepted: false, failed: false };
                        }
                    } catch {
                        // 読めなければ通常の失敗として返す
                    }
                }
                break;
            }
        }
    }

    return createFailedSwipeResult(lastError);
}

export async function getParticipantCount(options = {}) {
    const channel = normalizeChannel(options.channel);
    // A direct REST read is small and avoids blocking the first paint while the
    // realtime SDK is still loading (or is stalled by an in-app browser).
    try {
        const restCount = await getParticipantCountFromRest(channel);
        if (restCount !== null) {
            return restCount;
        }
    } catch (error) {
        console.info("[firebase] REST count fetch failed; using SDK:", error);
    }

    const database = await ensureDatabase();
    if (!database) {
        return null;
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return null;
    }

    const snapshot = await sdk.get(sdk.ref(database, getParticipantCountPath(channel)));
    return Number(snapshot.val()) || 0;
}

export async function getLastCelebratedCount(options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return 0;
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return 0;
    }

    const channel = normalizeChannel(options.channel);
    const snapshot = await sdk.get(sdk.ref(database, getLastCelebratedCountPath(channel)));
    return Math.max(0, Math.floor(Number(snapshot.val()) || 0));
}

export async function setLastCelebratedCount(count, options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        throw new Error("Firebase database is unavailable.");
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        throw new Error("Firebase SDK is unavailable.");
    }

    const channel = normalizeChannel(options.channel);
    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    await sdk.set(sdk.ref(database, getLastCelebratedCountPath(channel)), safeCount);
    return safeCount;
}

export async function getLatestSwipeComplete(options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return null;
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return null;
    }

    const channel = normalizeChannel(options.channel);
    const snapshot = await sdk.get(sdk.ref(database, getSwipesPath(channel)));
    let latest = null;

    snapshot.forEach((child) => {
        const data = child.val();
        if (!data || data.type !== "swipe-completed") {
            return;
        }
        const candidate = { id: child.key, ...data };
        const candidateCount = Number(candidate.count) || 0;
        const latestCount = Number(latest?.count) || 0;
        const candidateCreatedAt = Number(candidate.createdAt) || 0;
        const latestCreatedAt = Number(latest?.createdAt) || 0;
        if (
            !latest ||
            candidateCreatedAt > latestCreatedAt ||
            (candidateCreatedAt === latestCreatedAt && candidateCount > latestCount)
        ) {
            latest = candidate;
        }
    });

    return latest;
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

        callback({
            id: snap.key,
            ...data,
            name: isInappropriateName(data.name) ? null : data.name,
        });
    });
}

// 参加カウントとは独立した「名前だけ」の通知（名前確定時に送る・カウントは増やさない）
export async function publishNameAnnouncement(payload = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return { fallback: true };
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return { fallback: true };
    }

    const channel = normalizeChannel(payload.channel);
    const candidateName = typeof payload.name === "string" ? payload.name.trim().slice(0, 24) : null;
    const rawName = candidateName && !isInappropriateName(candidateName) ? candidateName : null;

    if (!rawName) {
        return { blocked: true };
    }

    const ref = sdk.push(sdk.ref(database, getNameShoutsPath(channel)));
    const announcement = {
        type: "name-announced",
        createdAt: sdk.serverTimestamp(),
        name: rawName || null,
        source: payload.source ?? channel,
        visitorId: payload.visitorId ?? null,
        isReturning: payload.isReturning === true,
        isSupporter: payload.isSupporter === true,
        isConsecutiveReturn: payload.isConsecutiveReturn === true,
        streakDays: Math.max(1, Number(payload.streakDays) || 1),
        totalDays: Math.max(1, Number(payload.totalDays) || 1),
        tickerFont: normalizeTickerFont(payload.tickerFont),
    };
    const swipeEventId = typeof payload.swipeEventId === "string"
        ? payload.swipeEventId.trim().slice(0, 64)
        : "";
    const swipeCount = Math.floor(Number(payload.swipeCount));
    if (/^[A-Za-z0-9_-]+$/.test(swipeEventId)) {
        announcement.swipeEventId = swipeEventId;
    }
    if (Number.isFinite(swipeCount) && swipeCount > 0) {
        announcement.swipeCount = swipeCount;
    }
    let lastError = null;

    for (const delayMs of WRITE_RETRY_DELAYS_MS) {
        if (delayMs > 0) {
            await wait(delayMs);
        }
        try {
            await sdk.set(ref, announcement);
            return { key: ref.key };
        } catch (error) {
            lastError = error;
            console.warn("[firebase] name announcement attempt failed:", error);
        }
    }

    return { failed: true, retryable: true, error: lastError };
}

export async function subscribeToNameAnnouncements(callback, options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return () => {};
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return () => {};
    }

    const channel = normalizeChannel(options.channel);
    const shoutsRef = sdk.ref(database, getNameShoutsPath(channel));
    // A moving one-item query emits the newest child and every child that
    // subsequently becomes newest, without downloading the full history.
    const liveQuery = sdk.query(shoutsRef, sdk.limitToLast(1));
    const knownIds = new Set();

    // Callers that already fetched the current list can provide its IDs and
    // avoid downloading the same snapshot again before listening for deltas.
    const suppliedKnownIds = Array.isArray(options.knownIds);
    if (suppliedKnownIds) {
        options.knownIds.forEach((id) => {
            if (typeof id === "string" && id) knownIds.add(id);
        });
    }

    if (!suppliedKnownIds) {
        try {
            const snapshot = await sdk.get(liveQuery);
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    knownIds.add(child.key);
                });
            }
        } catch (error) {
            console.warn("[firebase] initial name shouts fetch failed:", error);
        }
    }

    return sdk.onChildAdded(liveQuery, (snap) => {
        if (knownIds.has(snap.key)) {
            return;
        }
        knownIds.add(snap.key);

        const data = snap.val();
        if (!data || data.type !== "name-announced" || isInappropriateName(data.name)) {
            return;
        }

        callback({ id: snap.key, ...data });
    });
}

export async function getRecentNameAnnouncements(options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return [];
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return [];
    }

    const channel = normalizeChannel(options.channel);
    const shoutsRef = sdk.ref(database, getNameShoutsPath(channel));
    const participantHistoryRef = sdk.ref(database, getParticipantHistoryPath(channel));
    const requestedLimit = Math.floor(Number(options.limit) || 30);
    const query = options.all === true
        ? shoutsRef
        : sdk.query(shoutsRef, sdk.limitToLast(Math.max(1, Math.min(requestedLimit, 100))));
    const [snapshot, participantHistorySnapshot] = await Promise.all([
        sdk.get(query),
        sdk.get(participantHistoryRef).catch(() => null),
    ]);
    const participantHistory = participantHistorySnapshot?.val?.() || {};
    const announcements = [];

    snapshot.forEach((child) => {
        const data = child.val();
        if (data?.type === "name-announced" && !isInappropriateName(data.name)) {
            announcements.push(enrichAnnouncementWithParticipantHistory({ id: child.key, ...data }, participantHistory));
        }
    });

    return announcements;
}

export async function getLatestNameAnnouncementForVisitor(visitorId, options = {}) {
    if (typeof visitorId !== "string" || !visitorId) {
        return null;
    }

    const database = await ensureDatabase();
    if (!database) {
        return null;
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return null;
    }

    const channel = normalizeChannel(options.channel);
    const shoutsRef = sdk.ref(database, getNameShoutsPath(channel));
    const query = sdk.query(
        shoutsRef,
        sdk.orderByChild("visitorId"),
        sdk.equalTo(visitorId)
    );
    const snapshot = await sdk.get(query);
    const announcements = [];

    snapshot.forEach((child) => {
        const data = child.val();
        if (data?.type === "name-announced" && !isInappropriateName(data.name)) {
            announcements.push({ id: child.key, ...data });
        }
    });

    announcements.sort((a, b) =>
        (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0) ||
        String(b.id).localeCompare(String(a.id))
    );
    return announcements[0] ?? null;
}

function sanitizeSupporterComment(payload = {}) {
    const codeHash = typeof payload.codeHash === "string" ? payload.codeHash.trim().toLowerCase() : "";
    const comment = typeof payload.comment === "string" ? payload.comment.trim().slice(0, 60) : "";
    const candidateName = typeof payload.name === "string" ? payload.name.trim().slice(0, 24) : "";
    const name = candidateName && !isInappropriateName(candidateName) ? candidateName : null;

    if (!/^[a-f0-9]{64}$/.test(codeHash) || !comment || isInappropriateName(comment)) {
        return null;
    }

    return { codeHash, comment, name };
}

function normalizeSupporterCommentRecord(id, data) {
    if (!data || data.type !== "supporter-comment") {
        return null;
    }
    const comment = typeof data.comment === "string" ? data.comment.trim().slice(0, 60) : "";
    const name = typeof data.name === "string" ? data.name.trim().slice(0, 24) : "";
    if (!comment || isInappropriateName(comment) || (name && isInappropriateName(name))) {
        return null;
    }
    return {
        id,
        ...data,
        comment,
        name: name || null,
        createdAt: Number(data.createdAt) || 0,
    };
}

export async function publishSupporterComment(payload = {}) {
    const sanitized = sanitizeSupporterComment(payload);
    if (!sanitized) {
        return { blocked: true };
    }

    const database = await ensureDatabase();
    if (!database) {
        return { fallback: true };
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return { fallback: true };
    }

    const channel = normalizeChannel(payload.channel);
    const listRef = sdk.ref(database, getSupporterCommentsPath(channel));
    const record = {
        type: "supporter-comment",
        createdAt: sdk.serverTimestamp(),
        codeHash: sanitized.codeHash,
        comment: sanitized.comment,
        name: sanitized.name,
        source: payload.source ?? channel,
        visitorId: payload.visitorId ?? null,
    };
    const swipeEventId = typeof payload.swipeEventId === "string"
        ? payload.swipeEventId.trim().slice(0, 64)
        : "";
    const swipeCount = Math.floor(Number(payload.swipeCount));
    if (/^[A-Za-z0-9_-]+$/.test(swipeEventId)) {
        record.swipeEventId = swipeEventId;
    }
    if (Number.isFinite(swipeCount) && swipeCount > 0) {
        record.swipeCount = swipeCount;
    }
    let lastError = null;

    for (const delayMs of WRITE_RETRY_DELAYS_MS) {
        if (delayMs > 0) {
            await wait(delayMs);
        }
        try {
            const entryRef = sdk.push(listRef);
            await sdk.set(entryRef, record);
            return { key: entryRef.key };
        } catch (error) {
            lastError = error;
            console.warn("[firebase] supporter comment publish attempt failed:", error);
        }
    }

    return { failed: true, retryable: true, error: lastError };
}

export async function getSupporterComments(options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return [];
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return [];
    }

    const channel = normalizeChannel(options.channel);
    const snapshot = await sdk.get(sdk.ref(database, getSupporterCommentsPath(channel)));
    const comments = [];
    snapshot.forEach((child) => {
        const record = normalizeSupporterCommentRecord(child.key, child.val());
        if (record) {
            comments.push(record);
        }
    });
    comments.sort((a, b) => b.createdAt - a.createdAt || String(b.id).localeCompare(String(a.id)));
    return comments;
}

export async function subscribeToSupporterComments(callback, options = {}) {
    const database = await ensureDatabase();
    if (!database) {
        return () => {};
    }
    const sdk = await loadFirebaseSdk();
    if (!sdk) {
        return () => {};
    }

    const channel = normalizeChannel(options.channel);
    return sdk.onValue(sdk.ref(database, getSupporterCommentsPath(channel)), (snapshot) => {
        const comments = [];
        snapshot.forEach((child) => {
            const record = normalizeSupporterCommentRecord(child.key, child.val());
            if (record) {
                comments.push(record);
            }
        });
        comments.sort((a, b) => b.createdAt - a.createdAt || String(b.id).localeCompare(String(a.id)));
        callback(comments);
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
