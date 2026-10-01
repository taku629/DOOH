import assert from "node:assert/strict";
import test from "node:test";

import { getNameModerationReason, isInappropriateName } from "../src/name-filter.js";

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


test("blocks high-risk public impersonation and personal info", () => {
    const cases = [
        ["\u4eac\u738b\u516c\u5f0f", "impersonation"],
        ["\u65b0\u5bbf\u533a\u8077\u54e1", "impersonation"],
        ["\u5927\u5b66\u516c\u5f0f", "impersonation"],
        ["\u5b66\u7c4d\u756a\u53f7 123456", "personal_info"],
    ];

    for (const [name, reason] of cases) {
        assert.equal(getNameModerationReason(name), reason, name);
        assert.equal(isInappropriateName(name), true, name);
    }
});

test("does not block ordinary affiliation-like names", () => {
    for (const name of ["\u7ba1\u7406\u90e8\u306e\u5c71\u5d0e", "\u4eac\u738b\u597d\u304d", "\u5148\u751f\u3042\u308a\u304c\u3068\u3046"]) {
        assert.equal(isInappropriateName(name), false, name);
    }
});
