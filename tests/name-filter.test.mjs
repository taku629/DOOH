import assert from "node:assert/strict";
import test from "node:test";

import { isInappropriateName } from "../src/name-filter.js";

test("allows ordinary display names", () => {
    for (const name of ["さくら", "ハタ", "Takumu", "Xavier", "サポーター#7G8S", "新宿好き"]) {
        assert.equal(isInappropriateName(name), false, name);
    }
});

test("blocks abusive words and common obfuscation", () => {
    for (const name of ["死ね", "し ね", "ク・ソ", "f.u.c.k", "n a z i", "k1ll"]) {
        assert.equal(isInappropriateName(name), true, name);
    }
});

test("blocks links, contact details, and spam", () => {
    for (const name of [
        "https://example.com",
        "test@example.com",
        "090-1234-5678",
        "Instagram: example_user",
        "!!!!!!!!",
        "aaaaaaaaaa",
    ]) {
        assert.equal(isInappropriateName(name), true, name);
    }
});

test("blocks official impersonation and invisible controls", () => {
    for (const name of ["新宿区 公式", "運営・公式", "administrator", "さく\u200bら"]) {
        assert.equal(isInappropriateName(name), true, name);
    }
});
