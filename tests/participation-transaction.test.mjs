import assert from "node:assert/strict";
import test from "node:test";

import { buildParticipationTransactionValue } from "../src/participation-transaction.mjs";

test("new visitors cannot claim a returning streak from local data", () => {
    const result = buildParticipationTransactionValue({}, {
        key: "event-1",
        visitorId: "anonymous-device",
        participationDate: "2026-06-14",
        isReturning: true,
        isConsecutiveReturn: true,
        streakDays: 7,
    });

    assert.equal(result.participantCount, 1);
    assert.equal(result.swipes["event-1"].visitorId, "anonymous-device");
    assert.equal(result.swipes["event-1"].isReturning, false);
    assert.equal(result.swipes["event-1"].streakDays, 1);
    assert.equal(result.participantHistory["anonymous-device"].streakDays, 1);
});

test("same anonymous visitor is only counted once per participation date", () => {
    const first = buildParticipationTransactionValue({}, {
        key: "event-1",
        visitorId: "anonymous-device",
        participationDate: "2026-06-14",
    });
    const duplicate = buildParticipationTransactionValue(first, {
        key: "event-2",
        visitorId: "anonymous-device",
        participationDate: "2026-06-14",
    });

    assert.equal(duplicate.participantCount, 1);
    assert.equal(duplicate.swipes["event-2"], undefined);
    assert.equal(duplicate.dailyParticipants["2026-06-14"]["anonymous-device"], 1);
});

test("same anonymous visitor can participate again on the following date", () => {
    const first = buildParticipationTransactionValue({}, {
        key: "event-1",
        visitorId: "anonymous-device",
        participationDate: "2026-06-14",
    });
    const nextDay = buildParticipationTransactionValue(first, {
        key: "event-2",
        visitorId: "anonymous-device",
        participationDate: "2026-06-15",
    });

    assert.equal(nextDay.participantCount, 2);
    assert.equal(nextDay.swipes["event-2"].isConsecutiveReturn, true);
    assert.equal(nextDay.swipes["event-2"].streakDays, 2);
});

test("existing swipe history migrates into server participant history", () => {
    const nextDay = buildParticipationTransactionValue({
        participantCount: 1,
        swipes: {
            "event-1": {
                visitorId: "existing-device",
                participationDate: "2026-06-14",
                streakDays: 3,
            },
        },
    }, {
        key: "event-2",
        visitorId: "existing-device",
        participationDate: "2026-06-15",
    });

    assert.equal(nextDay.swipes["event-2"].streakDays, 4);
    assert.equal(nextDay.participantHistory["existing-device"].streakDays, 4);
});

test("thirty distinct simultaneous-style events are all counted once", () => {
    let data = {};

    for (let index = 0; index < 30; index += 1) {
        data = buildParticipationTransactionValue(data, {
            key: `event-${index}`,
            visitorId: `visitor-${index}`,
            participationDate: "2026-06-16",
            createdAt: index,
        });
    }

    assert.equal(data.participantCount, 30);
    assert.equal(Object.keys(data.swipes).length, 30);
    assert.equal(Object.keys(data.dailyParticipants["2026-06-16"]).length, 30);
});
