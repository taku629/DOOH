const DISPLAY_NAME_STORAGE_KEY = "shinjuku-dooh-display-name";

export function getSavedDisplayName(options = {}) {
    const storage = options.storage ?? globalThis.localStorage;
    const storageKey = options.storageKey ?? DISPLAY_NAME_STORAGE_KEY;

    try {
        const value = storage?.getItem(storageKey)?.trim() || "";
        return value.slice(0, 20);
    } catch {
        return "";
    }
}

export function saveDisplayName(name, options = {}) {
    const storage = options.storage ?? globalThis.localStorage;
    const storageKey = options.storageKey ?? DISPLAY_NAME_STORAGE_KEY;
    const value = String(name ?? "").trim().slice(0, 20);

    if (!value) {
        return;
    }
    storage?.setItem(storageKey, value);
}

export function clearSavedDisplayName(options = {}) {
    const storage = options.storage ?? globalThis.localStorage;
    const storageKey = options.storageKey ?? DISPLAY_NAME_STORAGE_KEY;
    storage?.removeItem(storageKey);
}

export { DISPLAY_NAME_STORAGE_KEY };
