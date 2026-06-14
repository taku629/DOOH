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

    if (swipes[event.key]) {
        return currentData;
    }

    const participationDate =
        typeof event.participationDate === "string" ? event.participationDate : null;
    const visitorId = typeof event.visitorId === "string" ? event.visitorId : null;
    if (participationDate && visitorId && dailyParticipants[participationDate]?.[visitorId]) {
        return currentData;
    }

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
                isReturning: event.isReturning ?? false,
                isConsecutiveReturn: event.isConsecutiveReturn ?? false,
                streakDays: event.streakDays ?? 1,
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
    };
}
