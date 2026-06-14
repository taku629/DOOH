const STORAGE_KEY = "shinjuku-dooh-participation";

function formatLocalDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
        return null;
    }
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function differenceInCalendarDays(from, to) {
    const fromDate = parseLocalDate(from);
    const toDate = parseLocalDate(to);
    if (!fromDate || !toDate) {
        return null;
    }
    return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

function createVisitorId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function buildParticipationVisit(previous = {}, today = formatLocalDate()) {
    const lastParticipationDate =
        typeof previous.lastParticipationDate === "string"
            ? previous.lastParticipationDate
            : null;
    const dayDifference = differenceInCalendarDays(lastParticipationDate, today);
    const previousStreak = Math.max(1, Number(previous.streakDays) || 1);
    const isReturning = dayDifference !== null && dayDifference >= 1;
    const isConsecutiveReturn = dayDifference === 1;
    const alreadyParticipatedToday = dayDifference === 0;
    const streakDays = isConsecutiveReturn ? previousStreak + 1 : 1;

    return {
        visitorId:
            typeof previous.visitorId === "string" && previous.visitorId
                ? previous.visitorId
                : createVisitorId(),
        participationDate: today,
        lastParticipationDate: today,
        isReturning,
        isConsecutiveReturn,
        alreadyParticipatedToday,
        streakDays,
    };
}

export function getParticipationVisit(options = {}) {
    const storage = options.storage ?? globalThis.localStorage;
    const storageKey = options.storageKey ?? STORAGE_KEY;
    const today = options.today ?? formatLocalDate();
    let previous = {};

    try {
        previous = JSON.parse(storage?.getItem(storageKey) || "{}");
    } catch {
        previous = {};
    }

    return buildParticipationVisit(previous, today);
}

export function saveParticipationVisit(visit, options = {}) {
    const storage = options.storage ?? globalThis.localStorage;
    const storageKey = options.storageKey ?? STORAGE_KEY;
    storage?.setItem(storageKey, JSON.stringify({
        visitorId: visit.visitorId,
        lastParticipationDate: visit.participationDate,
        streakDays: visit.streakDays,
    }));
}

export function clearParticipationVisit(options = {}) {
    const storage = options.storage ?? globalThis.localStorage;
    const storageKey = options.storageKey ?? STORAGE_KEY;
    storage?.removeItem(storageKey);
}

export { STORAGE_KEY, formatLocalDate };
