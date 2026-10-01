const CHANNEL_NAME = "dooh-participation";
const STORAGE_KEY = "dooh:participation-event";

function normalizeChannel(channel = "default") {
    return channel === "v2" || channel === "morning" || channel === "research" || channel === "youtube"
        ? channel
        : "default";
}

function createFallbackId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

export function publishParticipationEvent(payload = {}) {
    const channelName = normalizeChannel(payload.channel);
    const donationAmountYen = Number(payload.donationAmountYen);
    const count = Number(payload.count);
    const event = {
        id: createFallbackId(),
        type: payload.type || "swipe-completed",
        channel: channelName,
        source: payload.source ?? channelName,
        name: payload.name || "Guest",
        donationAmountYen: Number.isFinite(donationAmountYen) ? donationAmountYen : null,
        count: Number.isFinite(count) ? count : null,
        createdAt: new Date().toISOString(),
    };

    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(event));
    } catch (error) {
        console.warn("[participation] localStorage publish failed:", error);
    }

    if ("BroadcastChannel" in window) {
        let channel;
        try {
            channel = new BroadcastChannel(CHANNEL_NAME);
            channel.postMessage(event);
        } catch (error) {
            console.warn("[participation] BroadcastChannel publish failed:", error);
        } finally {
            channel?.close();
        }
    }

    return event;
}

export function subscribeToParticipationEvents(callback, options = {}) {
    let channel;
    const expectedChannel = normalizeChannel(options.channel);
    let lastEventId = null;

    function handleEvent(event) {
        if (!event || event.id === lastEventId) {
            return;
        }
        if (normalizeChannel(event.channel) !== expectedChannel) {
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

    const handleMessage = (event) => handleEvent(event.data);

    if ("BroadcastChannel" in window) {
        try {
            channel = new BroadcastChannel(CHANNEL_NAME);
            channel.addEventListener("message", handleMessage);
        } catch (error) {
            console.warn("[participation] BroadcastChannel subscribe failed:", error);
        }
    }

    try {
        const latestEvent = window.localStorage?.getItem(STORAGE_KEY);
        if (latestEvent) {
            try {
                const parsedEvent = JSON.parse(latestEvent);
                if (normalizeChannel(parsedEvent.channel) === expectedChannel) {
                    lastEventId = parsedEvent.id;
                }
            } catch {
                lastEventId = null;
            }
        }
    } catch (error) {
        console.warn("[participation] localStorage subscribe failed:", error);
    }

    return () => {
        window.removeEventListener("storage", handleStorage);
        channel?.removeEventListener("message", handleMessage);
        channel?.close();
    };
}
