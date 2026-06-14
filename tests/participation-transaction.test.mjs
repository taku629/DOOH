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
