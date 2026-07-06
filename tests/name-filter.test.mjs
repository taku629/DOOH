import assert from "node:assert/strict";
import test from "node:test";

import { getNameModerationReason, isInappropriateName } from "../src/name-filter.js";

test("allows ordinary display names", () => {
    for (const name of ["さくら", "ハタ", "Takumu", "Xavier", "サポーター#7G8S", "新宿好き"]) {
        assert.equal(isInappropriateName(name), false, name);
    }
});

test("blocks Japanese abusive words and common obfuscation", () => {
    for (const name of ["死ね", "し ね", "シ・ネ", "クソ", "くーーそ", "援交", "パパ活"]) {
        assert.equal(isInappropriateName(name), true, name);
    }
});

test("blocks English abusive words and common obfuscation", () => {
    for (const name of ["f.u.c.k", "n a z i", "k1ll", "p0rn", "s e x", "a$s.hole", "k y s"]) {
        assert.equal(isInappropriateName(name), true, name);
    }
});

test("blocks links, contact details, and spam", () => {
    for (const name of [
        "https://example.com",
        "test@example.com",
        "090-1234-5678",
        "Instagram: example_user",
        "LINE: sample_id",
        "!!!!!!!!",
        "aaaaaaaaaa",
    ]) {
        assert.equal(isInappropriateName(name), true, name);
    }
});

test("blocks official impersonation and invisible controls", () => {
    for (const name of ["新宿区 公式", "運営・公式", "administrator", "さくら\u200b"]) {
        assert.equal(isInappropriateName(name), true, name);
    }
});

test("blocks high-risk public impersonation and personal info", () => {
    const cases = [
        ["京王公式", "impersonation"],
        ["新宿区職員", "impersonation"],
        ["大学公式", "impersonation"],
        ["学籍番号 123456", "personal_info"],
    ];

    for (const [name, reason] of cases) {
        assert.equal(getNameModerationReason(name), reason, name);
        assert.equal(isInappropriateName(name), true, name);
    }
});

test("does not block ordinary affiliation-like names", () => {
    for (const name of ["管理部の山崎", "京王好き", "先生ありがとう"]) {
        assert.equal(isInappropriateName(name), false, name);
    }
});
