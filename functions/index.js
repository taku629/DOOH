"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const database = admin.database();
const ServerValue = admin.database.ServerValue;

const CHANNEL_PATHS = {
    default: "participation",
    v2: "participationV2",
    morning: "participationMorning",
};
const DEFAULT_DONATION_YEN = 100;
const MAX_DONATION_YEN = 10000;
const MAX_NAME_LENGTH = 20;
const MAX_SOURCE_LENGTH = 64;
const MAX_USER_AGENT_LENGTH = 240;
const SHARD_COUNT = 64;
const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{16,96}$/;
const RESERVATION_TTL_MS = 2 * 60 * 1000;

function normalizeChannel(channel = "default") {
    return Object.hasOwn(CHANNEL_PATHS, channel) ? channel : "default";
}

function sanitizeString(value, fallback, maxLength) {
    const text = String(value || fallback).trim();
    return (text || fallback).slice(0, maxLength);
}

function sanitizeDonationAmount(value) {
    const amount = Math.round(Number(value) || DEFAULT_DONATION_YEN);
    return Math.max(1, Math.min(amount, MAX_DONATION_YEN));
}

function getShardId(eventId) {
    let hash = 0;
    for (const character of eventId) {
        hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return String(hash % SHARD_COUNT).padStart(2, "0");
}

function buildSwipeEvent(data, request, channel) {
    const donationAmountYen = sanitizeDonationAmount(data.donationAmountYen);
    const userAgent = request.rawRequest.get("user-agent") || null;

    return {
        type: "swipe-completed",
        createdAt: ServerValue.TIMESTAMP,
        source: sanitizeString(data.source, channel, MAX_SOURCE_LENGTH),
        channel,
        name: sanitizeString(data.name, "匿名サポーター", MAX_NAME_LENGTH),
        donationAmountYen,
        userAgent: userAgent ? userAgent.slice(0, MAX_USER_AGENT_LENGTH) : null,
    };
}

async function reserveEventId(markerRef, now) {
    return markerRef.transaction((currentValue) => {
        if (!currentValue) {
            return {
                status: "reserved",
                reservedAt: ServerValue.TIMESTAMP,
                expiresAt: now + RESERVATION_TTL_MS,
            };
        }

        if (currentValue.status === "reserved" && Number(currentValue.expiresAt) < now) {
            return {
                status: "reserved",
                reservedAt: ServerValue.TIMESTAMP,
                expiresAt: now + RESERVATION_TTL_MS,
            };
        }

        return;
    }, undefined, false);
}

exports.submitSwipeComplete = onCall({
    region: "asia-southeast1",
    timeoutSeconds: 10,
    memory: "256MiB",
    concurrency: 80,
    maxInstances: 200,
    enforceAppCheck: process.env.ENFORCE_APP_CHECK === "true",
}, async (request) => {
    const data = request.data || {};
    const clientEventId = String(data.clientEventId || "");

    if (!EVENT_ID_PATTERN.test(clientEventId)) {
        throw new HttpsError("invalid-argument", "clientEventId is required.");
    }

    const channel = normalizeChannel(data.channel);
    const basePath = CHANNEL_PATHS[channel];
    const markerRef = database.ref(`${basePath}/eventIds/${clientEventId}`);
    const reservation = await reserveEventId(markerRef, Date.now());

    if (!reservation.committed) {
        if (data.returnCount === false) {
            return {
                duplicate: true,
                eventId: clientEventId,
                count: null,
                channel,
            };
        }

        const participantCountSnapshot = await database.ref(`${basePath}/participantCount`).get();
        return {
            duplicate: true,
            eventId: clientEventId,
            count: Number(participantCountSnapshot.val()) || 0,
            channel,
        };
    }

    const shardId = getShardId(clientEventId);
    const event = buildSwipeEvent(data, request, channel);
    const updates = {
        [`${basePath}/participantCount`]: ServerValue.increment(1),
        [`${basePath}/swipes/${clientEventId}`]: event,
        [`${basePath}/counterShards/${shardId}/count`]: ServerValue.increment(1),
        [`${basePath}/counterShards/${shardId}/updatedAt`]: ServerValue.TIMESTAMP,
        [`${basePath}/eventIds/${clientEventId}`]: {
            status: "committed",
            committedAt: ServerValue.TIMESTAMP,
        },
    };

    try {
        await database.ref().update(updates);
    } catch (error) {
        logger.error("submitSwipeComplete update failed", {
            channel,
            clientEventId,
            error,
        });
        await markerRef.remove().catch(() => {});
        throw new HttpsError("internal", "Swipe event could not be committed.");
    }

    if (data.returnCount === false) {
        return {
            duplicate: false,
            eventId: clientEventId,
            count: null,
            channel,
        };
    }

    const participantCountSnapshot = await database.ref(`${basePath}/participantCount`).get();
    return {
        duplicate: false,
        eventId: clientEventId,
        count: Number(participantCountSnapshot.val()) || 0,
        channel,
    };
});
