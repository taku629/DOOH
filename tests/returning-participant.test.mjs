import assert from "node:assert/strict";
import test from "node:test";

import {
    STORAGE_KEY,
    buildParticipationVisit,
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
    };
}

test("first participation is treated as new", () => {
    const visit = buildParticipationVisit({}, "2026-06-12");

    assert.equal(visit.isReturning, false);
    assert.equal(visit.isConsecutiveReturn, false);
    assert.equal(visit.streakDays, 1);
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

test("another participation on the same day stays a new daily participation", () => {
    const visit = buildParticipationVisit({
        visitorId: "anonymous-device",
        lastParticipationDate: "2026-06-12",
        streakDays: 2,
    }, "2026-06-12");

    assert.equal(visit.isReturning, false);
    assert.equal(visit.isConsecutiveReturn, false);
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
