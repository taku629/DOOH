export function getDonationTotalYen(participantCount, donationAmountYen) {
    const count = Math.max(0, Number(participantCount) || 0);
    const amount = Math.max(0, Number(donationAmountYen) || 0);

    return count * amount;
}

function getDonationMilestones(playlist) {
    const milestones = Array.isArray(playlist?.donationMilestones)
        ? playlist.donationMilestones
        : [];

    return milestones
        .map((milestone) => ({
            ...milestone,
            thresholdYen: Number(milestone?.thresholdYen),
        }))
        .filter((milestone) => Number.isFinite(milestone.thresholdYen) && milestone.thresholdYen > 0)
        .sort((current, next) => current.thresholdYen - next.thresholdYen);
}

export function getDonationMilestoneGoal(playlist, participantCount, donationAmountYen, options = {}) {
    const count = Math.max(0, Number(participantCount) || 0);
    const amount = Math.max(1, Number(donationAmountYen) || Number(options.fallbackDonationAmountYen) || 100);
    const fallbackThresholdYen = Math.max(
        amount,
        Number(options.fallbackThresholdYen) || amount * 50
    );
    const total = getDonationTotalYen(count, amount);
    const milestones = getDonationMilestones(playlist);
    const nextMilestone = milestones.find((milestone) => total < milestone.thresholdYen);
    const targetMilestone = nextMilestone || milestones[milestones.length - 1] || {
        thresholdYen: fallbackThresholdYen,
    };
    const thresholdYen = Math.max(
        amount,
        Number(targetMilestone.thresholdYen) || fallbackThresholdYen
    );
    const targetCount = Math.max(1, Math.ceil(thresholdYen / amount));
    const remainingCount = Math.max(0, targetCount - count);
    const progress = Math.max(0, Math.min(100, (count / targetCount) * 100));

    return {
        thresholdYen,
        targetCount,
        remainingCount,
        reached: remainingCount === 0,
        progress,
    };
}

export function getDonationMilestoneVideo(playlist, donationTotalYen) {
    const total = Math.max(0, Number(donationTotalYen) || 0);

    const matchedMilestone = getDonationMilestones(playlist)
        .filter((milestone) => {
            return milestone?.video && total >= milestone.thresholdYen;
        })
        .sort((current, next) => next.thresholdYen - current.thresholdYen)[0];

    return matchedMilestone?.video || null;
}
