const DISPLAY_NAME_STORAGE_KEY = "shinjuku-dooh-display-name";

export function getSavedDisplayName(options = {}) {
    const storage = options.storage ?? globalThis.localStorage;

    try {
        const value = storage?.getItem(DISPLAY_NAME_STORAGE_KEY)?.trim() || "";
        return value.slice(0, 20);
    } catch {
        return "";
    }
}

export function saveDisplayName(name, options = {}) {
    const storage = options.storage ?? globalThis.localStorage;
    const value = String(name ?? "").trim().slice(0, 20);

    if (!value) {
        return;
    }
    storage?.setItem(DISPLAY_NAME_STORAGE_KEY, value);
}

export function clearSavedDisplayName(options = {}) {
    const storage = options.storage ?? globalThis.localStorage;
    storage?.removeItem(DISPLAY_NAME_STORAGE_KEY);
}

export { DISPLAY_NAME_STORAGE_KEY };
