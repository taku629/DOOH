import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { dedupeBySupporter, reconcile, serialize, takeNext } = require("../src/supporter-comment-rotation.js");

const comments = (count) => Array.from({ length: count }, (_, index) => ({
    id: `comment-${index + 1}`,
    comment: `message ${index + 1}`,
}));

test("a fair cycle shows every supporter exactly once before repeating", () => {
    let state = reconcile({}, comments(25), () => 0.5);
    const shown = [];
    for (let index = 0; index < 25; index += 1) {
        const next = takeNext(state, () => 0.5);
        state = next.state;
        shown.push(next.entry.id);
    }

    assert.equal(new Set(shown).size, 25);
    assert.deepEqual(new Set(shown), new Set(comments(25).map((entry) => entry.id)));
});

test("a data refresh preserves the unshown portion instead of restarting", () => {
    let state = reconcile({}, comments(4), () => 0.5);
    const first = takeNext(state, () => 0.5);
    state = first.state;
    const second = takeNext(state, () => 0.5);
    state = second.state;

    const refreshed = reconcile(state, [...comments(4), ...comments(5).slice(4)], () => 0.5);
    const rest = [];
    let current = refreshed;
    for (let index = 0; index < 3; index += 1) {
        const next = takeNext(current, () => 0.5);
        current = next.state;
        rest.push(next.entry.id);
    }

    assert.ok(!rest.includes(first.entry.id));
    assert.ok(!rest.includes(second.entry.id));
    assert.ok(rest.includes("comment-5"));
});

test("serialized progress resumes the same cycle after reload", () => {
    let state = reconcile({}, comments(3), () => 0.5);
    const first = takeNext(state, () => 0.5);
    state = first.state;

    const restored = reconcile(serialize(state), comments(3), () => 0.5);
    const next = takeNext(restored, () => 0.5);

    assert.notEqual(next.entry.id, first.entry.id);
});

test("repeat posts from one supporter keep only the latest comment", () => {
    const deduped = dedupeBySupporter([
        { id: "comment-1", codeHash: "a".repeat(64), comment: "first", createdAt: 100 },
        { id: "comment-2", codeHash: "a".repeat(64), comment: "second", createdAt: 300 },
        { id: "comment-3", codeHash: "a".repeat(64), comment: "third", createdAt: 200 },
        { id: "comment-4", codeHash: "b".repeat(64), comment: "other", createdAt: 150 },
    ]);

    assert.deepEqual(
        deduped.map((entry) => entry.id).sort(),
        ["comment-2", "comment-4"]
    );
});

test("entries without a codeHash are kept individually", () => {
    const deduped = dedupeBySupporter([
        { id: "comment-1", comment: "no hash a", createdAt: 100 },
        { id: "comment-2", comment: "no hash b", createdAt: 200 },
        { id: "comment-3", codeHash: "", comment: "empty hash", createdAt: 300 },
    ]);

    assert.equal(deduped.length, 3);
});

test("equal timestamps fall back to the id ordering deterministically", () => {
    const deduped = dedupeBySupporter([
        { id: "comment-1", codeHash: "c".repeat(64), comment: "first", createdAt: 100 },
        { id: "comment-9", codeHash: "c".repeat(64), comment: "later id", createdAt: 100 },
    ]);

    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].id, "comment-9");
});

test("a new cycle does not immediately repeat the last item", () => {
    let state = reconcile({}, comments(3), () => 0);
    let last = null;
    for (let index = 0; index < 3; index += 1) {
        const next = takeNext(state, () => 0);
        state = next.state;
        last = next.entry.id;
    }
    const nextCycle = takeNext(state, () => 0);

    assert.notEqual(nextCycle.entry.id, last);
});
