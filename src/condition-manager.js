export function getDonationTotalYen(participantCount, donationAmountYen) {
    const count = Math.max(0, Number(participantCount) || 0);
    const amount = Math.max(0, Number(donationAmountYen) || 0);

    return count * amount;
}

export function getDonationMilestoneVideo(playlist, donationTotalYen) {
    const milestones = Array.isArray(playlist?.donationMilestones)
        ? playlist.donationMilestones
        : [];
    const total = Math.max(0, Number(donationTotalYen) || 0);

    const matchedMilestone = milestones
        .filter((milestone) => {
            const threshold = Number(milestone?.thresholdYen);

            return milestone?.video && Number.isFinite(threshold) && total >= threshold;
        })
        .sort((current, next) => Number(next.thresholdYen) - Number(current.thresholdYen))[0];

    return matchedMilestone?.video || null;
}
