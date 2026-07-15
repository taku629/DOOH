(function attachSupporterCommentRotation(globalScope) {
    function shuffle(items, random = Math.random, avoidFirstId = "") {
        const result = [...items];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(random() * (index + 1));
            [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
        }
        if (result.length > 1 && avoidFirstId && result[0]?.id === avoidFirstId) {
            const swapIndex = result.findIndex((entry) => entry?.id !== avoidFirstId);
            if (swapIndex > 0) {
                [result[0], result[swapIndex]] = [result[swapIndex], result[0]];
            }
        }
        return result;
    }

    function uniqueEntries(items) {
        const entries = [];
        const seenIds = new Set();
        for (const item of Array.isArray(items) ? items : []) {
            const id = String(item?.id ?? "").trim();
            if (!id || seenIds.has(id)) continue;
            seenIds.add(id);
            entries.push({ ...item, id });
        }
        return entries;
    }

    function reconcile(state = {}, items = [], random = Math.random) {
        const incoming = uniqueEntries(items);
        const byId = new Map(incoming.map((entry) => [entry.id, entry]));
        const previousIds = (Array.isArray(state.order) ? state.order : [])
            .map((entry) => String(entry?.id ?? entry ?? "").trim())
            .filter(Boolean);
        const previousCursor = Math.max(0, Math.min(
            Math.floor(Number(state.cursor) || 0),
            previousIds.length
        ));

        if (previousIds.length === 0) {
            return {
                order: shuffle(incoming, random, state.lastShownId),
                cursor: 0,
                lastShownId: String(state.lastShownId ?? ""),
            };
        }

        const shownIds = previousIds.slice(0, previousCursor).filter((id) => byId.has(id));
        const remainingIds = previousIds.slice(previousCursor).filter((id) => byId.has(id));
        const retainedIds = new Set([...shownIds, ...remainingIds]);
        const added = shuffle(
            incoming.filter((entry) => !retainedIds.has(entry.id)),
            random
        );
        const order = [
            ...shownIds.map((id) => byId.get(id)),
            ...remainingIds.map((id) => byId.get(id)),
            ...added,
        ];

        return {
            order,
            cursor: shownIds.length,
            lastShownId: String(state.lastShownId ?? ""),
        };
    }

    function takeNext(state = {}, random = Math.random) {
        let order = uniqueEntries(state.order);
        let cursor = Math.max(0, Math.min(Math.floor(Number(state.cursor) || 0), order.length));
        const lastShownId = String(state.lastShownId ?? "");

        if (order.length === 0) {
            return { entry: null, state: { order: [], cursor: 0, lastShownId } };
        }
        if (cursor >= order.length) {
            order = shuffle(order, random, lastShownId);
            cursor = 0;
        }

        const entry = order[cursor];
        return {
            entry,
            state: {
                order,
                cursor: cursor + 1,
                lastShownId: entry.id,
            },
        };
    }

    function serialize(state = {}) {
        return {
            order: (Array.isArray(state.order) ? state.order : [])
                .map((entry) => String(entry?.id ?? entry ?? "").trim())
                .filter(Boolean),
            cursor: Math.max(0, Math.floor(Number(state.cursor) || 0)),
            lastShownId: String(state.lastShownId ?? ""),
        };
    }

    const api = { reconcile, takeNext, serialize };
    globalScope.SupporterCommentRotation = api;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : window);
