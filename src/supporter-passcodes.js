const CONFIG_PATH = new URL("../config/supporter-passcodes.json", import.meta.url).href;
const HEX_RE = /^[a-f0-9]{64}$/;
let configPromise;

async function sha256Hex(value) {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
        return "";
    }
    const bytes = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function loadSupporterPasscodeConfig(fetchImpl = globalThis.fetch) {
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
            const codes = data?.codes && typeof data.codes === "object" ? data.codes : {};
            return {
                enabled: data?.enabled === true,
                codes,
            };
        } catch (error) {
            console.info("[supporter-passcode] config unavailable:", error);
            return null;
        }
    })();

    return configPromise;
}

export async function verifySupporterPasscode(code, options = {}) {
    const rawCode = String(code ?? "").replace(/\D/g, "").slice(0, 4);
    if (!/^\d{4}$/.test(rawCode)) {
        return { ok: false, reason: "format" };
    }

    const config = options.config ?? await loadSupporterPasscodeConfig(options.fetchImpl);
    if (!config?.enabled) {
        return { ok: false, reason: "disabled" };
    }

    const codeHash = await sha256Hex(rawCode);
    if (!HEX_RE.test(codeHash) || !Object.prototype.hasOwnProperty.call(config.codes, codeHash)) {
        return { ok: false, reason: "not_found" };
    }

    return {
        ok: true,
        codeHash,
        label: config.codes[codeHash]?.label ?? "supporter",
    };
}
