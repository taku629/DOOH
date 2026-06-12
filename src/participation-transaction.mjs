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

    if (swipes[event.key]) {
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
                participationDate: event.participationDate ?? null,
                isReturning: event.isReturning ?? false,
                isConsecutiveReturn: event.isConsecutiveReturn ?? false,
                streakDays: event.streakDays ?? 1,
            },
        },
    };
}
