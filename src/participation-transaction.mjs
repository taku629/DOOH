function differenceInCalendarDays(from, to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) {
        return null;
    }
    return Math.round(
        (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
    );
}

function findLatestVisitorSwipe(swipes, visitorId) {
    return Object.values(swipes).reduce((latest, swipe) => {
        if (swipe?.visitorId !== visitorId || typeof swipe.participationDate !== "string") {
            return latest;
        }
        if (!latest || swipe.participationDate > latest.lastParticipationDate) {
            return {
                lastParticipationDate: swipe.participationDate,
                streakDays: Math.max(1, Number(swipe.streakDays) || 1),
            };
        }
        return latest;
    }, null);
}

export function buildParticipationTransactionValue(currentValue, event) {
    if (!event?.key) {
        throw new Error("Participation event key is required.");
    }

    const currentData =
        currentValue && typeof currentValue === "object" ? currentValue : {};
    const swipes =
        currentData.swipes && typeof currentData.swipes === "object"
            ? currentData.swipes
            : {};
    const dailyParticipants =
        currentData.dailyParticipants && typeof currentData.dailyParticipants === "object"
            ? currentData.dailyParticipants
            : {};
    const participantHistory =
        currentData.participantHistory && typeof currentData.participantHistory === "object"
            ? currentData.participantHistory
            : {};

    if (swipes[event.key]) {
        return currentData;
    }

    const participationDate =
        typeof event.participationDate === "string" ? event.participationDate : null;
    const visitorId = typeof event.visitorId === "string" ? event.visitorId : null;
    if (participationDate && visitorId && dailyParticipants[participationDate]?.[visitorId]) {
        return currentData;
    }

    const previousVisit = visitorId
        ? participantHistory[visitorId] ?? findLatestVisitorSwipe(swipes, visitorId)
        : null;
    const dayDifference = differenceInCalendarDays(
        previousVisit?.lastParticipationDate,
        participationDate
    );
    const isReturning = dayDifference !== null && dayDifference >= 1;
    const isConsecutiveReturn = dayDifference === 1;
    const streakDays = isConsecutiveReturn
        ? Math.max(1, Number(previousVisit?.streakDays) || 1) + 1
        : 1;
    const currentCount = Number(currentData.participantCount);
    const participantCount = (Number.isFinite(currentCount) ? currentCount : 0) + 1;

    return {
        ...currentData,
        participantCount,
        swipes: {
            ...swipes,
            [event.key]: {
                type: "swipe-completed",
                createdAt: event.createdAt,
                count: participantCount,
                source: event.source ?? null,
                name: event.name ?? null,
                donationAmountYen: event.donationAmountYen ?? null,
                userAgent: event.userAgent ?? null,
                visitorId: event.visitorId ?? null,
                participationDate: event.participationDate ?? null,
                isReturning,
                isConsecutiveReturn,
                streakDays,
            },
        },
        dailyParticipants: participationDate && visitorId
            ? {
                ...dailyParticipants,
                [participationDate]: {
                    ...(dailyParticipants[participationDate] ?? {}),
                    [visitorId]: participantCount,
                },
            }
            : dailyParticipants,
        participantHistory: participationDate && visitorId
            ? {
                ...participantHistory,
                [visitorId]: {
                    lastParticipationDate: participationDate,
                    streakDays,
                },
            }
            : participantHistory,
    };
}
