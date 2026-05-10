const CHANNEL_NAME = "dooh-participation";
const STORAGE_KEY = "dooh:participation-event";

export function publishParticipationEvent(payload = {}) {
    const event = {
        id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: "participant-joined",
        name: payload.name || "Guest",
        createdAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(event));

    if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage(event);
        channel.close();
    }

    return event;
}

export function subscribeToParticipationEvents(callback) {
    let channel;
    let lastEventId = null;

    function handleEvent(event) {
        if (!event || event.id === lastEventId) {
            return;
        }

        lastEventId = event.id;
        callback(event);
    }

    function handleStorage(event) {
        if (event.key !== STORAGE_KEY || !event.newValue) {
            return;
        }

        try {
            handleEvent(JSON.parse(event.newValue));
        } catch (error) {
            console.warn("Invalid participation event payload:", error);
        }
    }

    window.addEventListener("storage", handleStorage);

    if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.addEventListener("message", (event) => handleEvent(event.data));
    }

    const latestEvent = localStorage.getItem(STORAGE_KEY);
    if (latestEvent) {
        try {
            lastEventId = JSON.parse(latestEvent).id;
        } catch {
            lastEventId = null;
        }
    }

    return () => {
        window.removeEventListener("storage", handleStorage);
        channel?.close();
    };
}
