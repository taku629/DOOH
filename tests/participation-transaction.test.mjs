import assert from "node:assert/strict";
import test from "node:test";

import { buildParticipationTransactionValue } from "../src/participation-transaction.mjs";

test("participation history keeps the anonymous visitor id", () => {
    const result = buildParticipationTransactionValue({}, {
        key: "event-1",
        visitorId: "anonymous-device",
        participationDate: "2026-06-14",
        isReturning: true,
    });

    assert.equal(result.participantCount, 1);
    assert.equal(result.swipes["event-1"].visitorId, "anonymous-device");
    assert.equal(result.swipes["event-1"].isReturning, true);
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
    assert.ok(nextDay.swipes["event-2"]);
});
