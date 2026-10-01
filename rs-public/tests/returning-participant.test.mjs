import assert from "node:assert/strict";
import test from "node:test";

import {
    STORAGE_KEY,
    buildParticipationVisit,
    clearParticipationVisit,
    getParticipationVisit,
    saveParticipationVisit,
} from "../src/returning-participant.mjs";

function createStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            values.set(key, value);
        },
        removeItem(key) {
            values.delete(key);
        },
    };
}

test("first participation is treated as new", () => {
    const visit = buildParticipationVisit({}, "2026-06-12");

    assert.equal(visit.isReturning, false);
    assert.equal(visit.isConsecutiveReturn, false);
    assert.equal(visit.streakDays, 1);
});

test("saved local participation can be cleared for testing", () => {
    const storage = createStorage();
    const visit = getParticipationVisit({ storage, today: "2026-06-11" });
    saveParticipationVisit(visit, { storage });

    clearParticipationVisit({ storage });

    assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("research participation storage stays separate from public participation", () => {
    const storage = createStorage();
    const publicVisit = getParticipationVisit({ storage, today: "2026-06-11" });
    saveParticipationVisit(publicVisit, { storage });
    const researchVisit = getParticipationVisit({
        storage,
        storageKey: `${STORAGE_KEY}-research`,
        today: "2026-06-12",
    });

    assert.equal(researchVisit.isReturning, false);
    assert.notEqual(researchVisit.visitorId, publicVisit.visitorId);
});

test("participation on the following day increments the streak", () => {
    const visit = buildParticipationVisit({
        visitorId: "anonymous-device",
        lastParticipationDate: "2026-06-11",
        streakDays: 3,
    }, "2026-06-12");

    assert.equal(visit.isReturning, true);
    assert.equal(visit.isConsecutiveReturn, true);
    assert.equal(visit.streakDays, 4);
});

test("another participation on the same day is marked as already participated", () => {
    const visit = buildParticipationVisit({
        visitorId: "anonymous-device",
        lastParticipationDate: "2026-06-12",
        streakDays: 2,
    }, "2026-06-12");

    assert.equal(visit.isReturning, false);
    assert.equal(visit.isConsecutiveReturn, false);
    assert.equal(visit.alreadyParticipatedToday, true);
    assert.equal(visit.streakDays, 1);
});

test("a skipped day resets the streak but remains returning", () => {
    const visit = buildParticipationVisit({
        visitorId: "anonymous-device",
        lastParticipationDate: "2026-06-10",
        streakDays: 3,
    }, "2026-06-12");

    assert.equal(visit.isReturning, true);
    assert.equal(visit.isConsecutiveReturn, false);
    assert.equal(visit.streakDays, 1);
});

test("total participation days keep increasing even when the streak breaks", () => {
    // 連続が途切れて streak は 1 に戻っても、通算参加日数は積み上がる（色はこちらで決まる）。
    const visit = buildParticipationVisit({
        visitorId: "anonymous-device",
        lastParticipationDate: "2026-06-10",
        streakDays: 1,
        totalDays: 3,
    }, "2026-06-12");

    assert.equal(visit.streakDays, 1);
    assert.equal(visit.totalDays, 4);
});

test("first participation starts the total at one", () => {
    const visit = buildParticipationVisit({ visitorId: "anonymous-device" }, "2026-06-12");

    assert.equal(visit.streakDays, 1);
    assert.equal(visit.totalDays, 1);
});

test("total days are not double counted on the same day", () => {
    const visit = buildParticipationVisit({
        visitorId: "anonymous-device",
        lastParticipationDate: "2026-06-12",
        streakDays: 2,
        totalDays: 2,
    }, "2026-06-12");

    assert.equal(visit.alreadyParticipatedToday, true);
    assert.equal(visit.totalDays, 2);
});

test("total days fall back to the streak for legacy saved data", () => {
    // totalDays を保存していなかった既存ユーザーは streakDays から補完する。
    const visit = buildParticipationVisit({
        visitorId: "anonymous-device",
        lastParticipationDate: "2026-06-11",
        streakDays: 3,
    }, "2026-06-12");

    assert.equal(visit.totalDays, 4);
});

test("saved local participation can be read on the next visit", () => {
    const storage = createStorage();
    const firstVisit = getParticipationVisit({ storage, today: "2026-06-11" });
    saveParticipationVisit(firstVisit, { storage });
    const nextVisit = getParticipationVisit({ storage, today: "2026-06-12" });

    assert.ok(storage.getItem(STORAGE_KEY));
    assert.equal(nextVisit.visitorId, firstVisit.visitorId);
    assert.equal(nextVisit.isConsecutiveReturn, true);
    assert.equal(nextVisit.streakDays, 2);
});
