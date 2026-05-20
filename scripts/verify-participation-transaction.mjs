import assert from "node:assert/strict";
import { buildParticipationTransactionValue } from "../src/participation-transaction.mjs";

function createEvent(index) {
    return {
        key: `event-${index}`,
        createdAt: 1715662800000 + index,
        name: null,
        userAgent: `test-agent-${index}`,
    };
}

let state = null;
const totalParticipants = 25;

for (let index = 1; index <= totalParticipants; index += 1) {
    state = articipationTransactionValubuildPe(state, createEvent(index));
}

assert.equal(state.participantCount, totalParticipants);
assert.equal(Object.keys(state.swipes).length, totalParticipants);

for (let index = 1; index <= totalParticipants; index += 1) {
    assert.equal(state.swipes[`event-${index}`].count, index);
}

const replayed = buildParticipationTransactionValue(state, createEvent(12));

assert.equal(replayed.participantCount, totalParticipants);
assert.equal(Object.keys(replayed.swipes).length, totalParticipants);

console.log(`Verified ${totalParticipants} concurrent-style participation updates.`);
