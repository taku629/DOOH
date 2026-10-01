import assert from "node:assert/strict";
import test from "node:test";

import { moderateDisplayName } from "../src/name-moderation.js";

test("moderateDisplayName blocks rule-based unsafe names before AI", async () => {
    const result = await moderateDisplayName("https://example.com", {
        config: { endpoint: "https://moderation.invalid", timeoutMs: 500 },
        fetchImpl: async () => {
            throw new Error("AI endpoint should not be called for rule blocks");
        },
    });

    assert.equal(result.allowed, false);
    assert.equal(result.source, "rule");
});

test("moderateDisplayName accepts names when AI moderation is not configured", async () => {
    const result = await moderateDisplayName("\u3055\u304f\u3089", { config: null });

    assert.equal(result.allowed, true);
    assert.equal(result.source, "rule-only");
});

test("moderateDisplayName follows AI endpoint block responses", async () => {
    const requests = [];
    const result = await moderateDisplayName("\u30c6\u30b9\u30c8", {
        config: { endpoint: "https://moderation.example/check", timeoutMs: 500 },
        fetchImpl: async (url, options) => {
            requests.push({ url, body: JSON.parse(options.body) });
            return {
                ok: true,
                async json() {
                    return { allowed: false, reason: "ai_policy" };
                },
            };
        },
    });

    assert.equal(result.allowed, false);
    assert.equal(result.source, "ai");
    assert.equal(result.reason, "ai_policy");
    assert.equal(requests[0].url, "https://moderation.example/check");
    assert.equal(requests[0].body.type, "display_name");
});
