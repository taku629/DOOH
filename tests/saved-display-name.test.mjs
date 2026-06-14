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

test("research display name stays separate from public display name", () => {
    const storage = createStorage();
    saveDisplayName("公共表示名", { storage });
    saveDisplayName("チーム表示名", {
        storage,
        storageKey: "shinjuku-dooh-display-name-research",
    });

    assert.equal(getSavedDisplayName({ storage }), "公共表示名");
    assert.equal(getSavedDisplayName({
        storage,
        storageKey: "shinjuku-dooh-display-name-research",
    }), "チーム表示名");
});
