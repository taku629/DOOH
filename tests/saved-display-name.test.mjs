import assert from "node:assert/strict";
import test from "node:test";

import {
    clearSavedDisplayName,
    getSavedDisplayName,
    saveDisplayName,
} from "../src/saved-display-name.mjs";

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

test("display name can be saved, read, and cleared locally", () => {
    const storage = createStorage();

    saveDisplayName("  タクヤ  ", { storage });
    assert.equal(getSavedDisplayName({ storage }), "タクヤ");

    clearSavedDisplayName({ storage });
    assert.equal(getSavedDisplayName({ storage }), "");
});
