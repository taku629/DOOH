import { getNameModerationReason } from "./name-filter.js";

const CONFIG_PATH = new URL("../config/moderation-config.json", import.meta.url).href;
const DEFAULT_TIMEOUT_MS = 1800;

let configPromise;

function timeoutSignal(timeoutMs) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return AbortSignal.timeout(timeoutMs);
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
}

function mergeSignals(signals) {
    const activeSignals = signals.filter(Boolean);
    if (activeSignals.length === 0) {
        return undefined;
    }
    if (activeSignals.length === 1) {
        return activeSignals[0];
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    for (const signal of activeSignals) {
        if (signal.aborted) {
            controller.abort();
            break;
        }
        signal.addEventListener("abort", abort, { once: true });
    }
    return controller.signal;
}

async function loadModerationConfig(fetchImpl = globalThis.fetch) {
    if (configPromise) {
        return configPromise;
    }

    configPromise = (async () => {
        if (typeof fetchImpl !== "function") {
            return null;
        }
        try {
            const response = await fetchImpl(CONFIG_PATH, { cache: "no-cache" });
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            const endpoint = typeof data.endpoint === "string" ? data.endpoint.trim() : "";
            if (data.enabled !== true || !endpoint) {
                return null;
            }
            return {
                endpoint,
                timeoutMs: Math.max(500, Math.min(Number(data.timeoutMs) || DEFAULT_TIMEOUT_MS, 5000)),
            };
        } catch (error) {
            console.info("[moderation] config unavailable:", error);
            return null;
        }
    })();

    return configPromise;
}

function normalizeAiModerationResult(data) {
    if (!data || typeof data !== "object") {
        return { allowed: true, source: "ai-empty" };
    }
    if (data.blocked === true || data.allowed === false || data.ok === false) {
        return {
            allowed: false,
            source: "ai",
            reason: typeof data.reason === "string" ? data.reason : "ai_blocked",
        };
    }
    return { allowed: true, source: "ai" };
}

export async function moderateDisplayName(name, options = {}) {
    const trimmed = String(name ?? "").trim().slice(0, 24);
    if (!trimmed) {
        return { allowed: true, source: "empty" };
    }

    const ruleReason = getNameModerationReason(trimmed);
    if (ruleReason) {
        return { allowed: false, source: "rule", reason: ruleReason };
    }

    const config = Object.prototype.hasOwnProperty.call(options, "config")
        ? options.config
        : await loadModerationConfig(options.fetchImpl);
    if (!config?.endpoint) {
        return { allowed: true, source: "rule-only" };
    }

    try {
        const timeout = timeoutSignal(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        const signal = mergeSignals([options.signal, timeout]);
        const response = await (options.fetchImpl ?? globalThis.fetch)(config.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "display_name",
                text: trimmed,
                locale: "ja-JP",
                maxLength: 24,
            }),
            signal,
        });
        if (!response.ok) {
            console.warn("[moderation] AI endpoint returned", response.status);
            return { allowed: true, source: "ai-unavailable" };
        }
        return normalizeAiModerationResult(await response.json());
    } catch (error) {
        console.warn("[moderation] AI check failed; rule result is used:", error);
        return { allowed: true, source: "ai-unavailable" };
    }
}
