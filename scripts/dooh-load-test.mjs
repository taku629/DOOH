#!/usr/bin/env node
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  increment,
  off,
  onChildAdded,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { computeVisitStats } from "../src/participation-transaction.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import process from "node:process";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "demo-dooh-load-test";
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST?.split(":")[0] || "127.0.0.1";
const DB_PORT = Number(process.env.FIREBASE_DATABASE_EMULATOR_HOST?.split(":")[1] || 9000);
const NS = process.env.FIREBASE_DATABASE_EMULATOR_NAMESPACE || `${PROJECT_ID}-default-rtdb`;
const OUT_DIR = process.env.DOOH_LOAD_OUT_DIR || "artifacts/load-test";
const DATE = new Date().toISOString().slice(0, 10);
const DONATION_AMOUNT_YEN = 100;
const WRITE_RETRY_DELAYS_MS = [0, 400, 1000];
const DEFAULT_COMMENT_HASH = "a".repeat(64);
const CHANNELS = new Map([
  ["default", "participation"],
  ["v2", "participationV2"],
  ["morning", "participationMorning"],
  ["research", "participationResearch"],
  ["youtube", "participationYouTube"],
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};
const round = (value) => Math.round(Number(value) * 10) / 10;

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
    } else {
      args.set(key, next);
      i += 1;
    }
  }
  return args;
}

function normalizeChannel(channel = "default") {
  return CHANNELS.has(channel) ? channel : "default";
}

function participationPath(channel) {
  return CHANNELS.get(normalizeChannel(channel));
}

function createAppDb(label) {
  const app = initializeApp(
    {
      projectId: PROJECT_ID,
      databaseURL: `https://${NS}.firebaseio.com`,
      apiKey: "fake-api-key-for-emulator",
      appId: `dooh-load-${label}`,
    },
    `dooh-load-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const db = getDatabase(app);
  connectDatabaseEmulator(db, DB_HOST, DB_PORT);
  return { app, db };
}

async function resetEmulatorDb() {
  const url = `http://${DB_HOST}:${DB_PORT}/.json?ns=${encodeURIComponent(NS)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json", "authorization": "Bearer owner" },
    body: JSON.stringify(null),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to reset emulator DB: HTTP ${response.status} ${text}`);
  }
}

// 本番クライアント(src/firebase-bridge.js publishSwipeComplete)と同じ
// 「履歴read → increment(1)+多パスupdate」フローを再現する。
async function publishSwipe(db, { index, channel, scenarioName }) {
  const normalizedChannel = normalizeChannel(channel);
  const base = participationPath(normalizedChannel);
  const eventRef = push(ref(db, `${base}/swipes`));
  const startedAt = performance.now();
  const today = DATE;
  const visitorId = `${scenarioName}-${normalizedChannel}-visitor-${String(index + 1).padStart(4, "0")}`;
  const dailyPath = `${base}/dailyParticipants/${today}/${visitorId}`;

  const duplicateResult = (attempts) => ({
    ok: false,
    committed: false,
    accepted: false,
    duplicate: true,
    count: null,
    latencyMs: performance.now() - startedAt,
    retryCount: 0,
    writeRetryCount: Math.max(0, attempts - 1),
    updaterCalls: attempts,
    attempts,
    key: eventRef.key,
    error: "already-participated-today",
    errorCode: "duplicate",
  });

  let previousVisit = null;
  try {
    const [historySnap, dailySnap] = await Promise.all([
      get(ref(db, `${base}/participantHistory/${visitorId}`)),
      get(ref(db, dailyPath)),
    ]);
    if (dailySnap.exists()) return duplicateResult(0);
    previousVisit = historySnap.val();
  } catch {}

  const stats = computeVisitStats(previousVisit, today);
  const event = {
    type: "swipe-completed",
    createdAt: serverTimestamp(),
    source: `load-test:${scenarioName}`,
    name: `負荷${String(index + 1).padStart(3, "0")}`,
    donationAmountYen: DONATION_AMOUNT_YEN,
    userAgent: "dooh-load-test/node",
    visitorId,
    participationDate: today,
    isReturning: stats.isReturning,
    isConsecutiveReturn: stats.isConsecutiveReturn,
    streakDays: stats.streakDays,
    totalDays: stats.totalDays,
    tickerFont: "noto",
  };
  const updates = {
    [`${base}/participantCount`]: increment(1),
    [`${base}/swipes/${eventRef.key}`]: event,
    [dailyPath]: serverTimestamp(),
    [`${base}/participantHistory/${visitorId}`]: {
      lastParticipationDate: today,
      streakDays: stats.streakDays,
      totalDays: stats.totalDays,
    },
  };

  let lastError = null;
  let attempts = 0;

  for (const delayMs of WRITE_RETRY_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);
    attempts += 1;
    try {
      await update(ref(db), updates);
      const confirmedAt = performance.now();
      return {
        ok: true,
        committed: true,
        accepted: true,
        count: null,
        latencyMs: confirmedAt - startedAt,
        retryCount: 0,
        writeRetryCount: Math.max(0, attempts - 1),
        updaterCalls: attempts,
        attempts,
        key: eventRef.key,
      };
    } catch (error) {
      lastError = error;
      if (/permission.denied/i.test(String(error?.code ?? "") + String(error?.message ?? ""))) {
        // 同日重複がrulesの !data.exists() で原子的に拒否されたケースを確認
        try {
          const dailySnap = await get(ref(db, dailyPath));
          if (dailySnap.exists()) return duplicateResult(attempts);
        } catch {}
        break;
      }
    }
  }

  const confirmedAt = performance.now();
  return {
    ok: false,
    committed: false,
    accepted: false,
    count: null,
    latencyMs: confirmedAt - startedAt,
    retryCount: 0,
    writeRetryCount: Math.max(0, attempts - 1),
    updaterCalls: attempts,
    attempts,
    key: eventRef.key,
    error: lastError?.message || String(lastError),
    errorCode: lastError?.code || null,
  };
}

async function publishName(db, { index, channel, scenarioName }) {
  const entryRef = push(ref(db, `nameShouts/${normalizeChannel(channel)}`));
  const record = {
    type: "name-announced",
    createdAt: serverTimestamp(),
    name: `名前${String(index + 1).padStart(3, "0")}`,
    source: `load-test:${scenarioName}`,
    visitorId: `${scenarioName}-${channel}-visitor-${String(index + 1).padStart(4, "0")}`,
    isReturning: false,
    isConsecutiveReturn: false,
    streakDays: 1,
    totalDays: 1,
    tickerFont: "noto",
  };
  try {
    await set(entryRef, record);
    return { ok: true, key: entryRef.key };
  } catch (error) {
    return { ok: false, key: entryRef.key, error: error?.message || String(error), errorCode: error?.code || null };
  }
}

async function publishComment(db, { index, channel, scenarioName }) {
  const entryRef = push(ref(db, `supporterComments/${normalizeChannel(channel)}`));
  const record = {
    type: "supporter-comment",
    createdAt: serverTimestamp(),
    codeHash: DEFAULT_COMMENT_HASH,
    comment: `応援コメント${String(index + 1).padStart(3, "0")}`,
    name: `支援者${String(index + 1).padStart(3, "0")}`,
    source: `load-test:${scenarioName}`,
    visitorId: `${scenarioName}-${channel}-visitor-${String(index + 1).padStart(4, "0")}`,
  };
  try {
    await set(entryRef, record);
    return { ok: true, key: entryRef.key };
  } catch (error) {
    return { ok: false, key: entryRef.key, error: error?.message || String(error), errorCode: error?.code || null };
  }
}

function watchDooh(db, channel) {
  const normalizedChannel = normalizeChannel(channel);
  const state = {
    channel: normalizedChannel,
    participantCountUpdates: 0,
    participantCountLast: 0,
    swipeChildAdded: 0,
    nameChildAdded: 0,
    supporterCommentUpdates: 0,
    supporterCommentLastCount: 0,
    errors: [],
  };
  const unsubs = [];
  const countRef = ref(db, `${participationPath(normalizedChannel)}/participantCount`);
  const swipesRef = ref(db, `${participationPath(normalizedChannel)}/swipes`);
  const namesRef = ref(db, `nameShouts/${normalizedChannel}`);
  const commentsRef = ref(db, `supporterComments/${normalizedChannel}`);
  unsubs.push(onValue(countRef, (snap) => {
    state.participantCountUpdates += 1;
    state.participantCountLast = Number(snap.val()) || 0;
  }, (error) => state.errors.push(error?.message || String(error))));
  unsubs.push(onChildAdded(swipesRef, (snap) => {
    if (snap.val()?.type === "swipe-completed") state.swipeChildAdded += 1;
  }, (error) => state.errors.push(error?.message || String(error))));
  unsubs.push(onChildAdded(namesRef, (snap) => {
    if (snap.val()?.type === "name-announced") state.nameChildAdded += 1;
  }, (error) => state.errors.push(error?.message || String(error))));
  unsubs.push(onValue(commentsRef, (snap) => {
    state.supporterCommentUpdates += 1;
    let count = 0;
    snap.forEach((child) => {
      if (child.val()?.type === "supporter-comment") count += 1;
    });
    state.supporterCommentLastCount = count;
  }, (error) => state.errors.push(error?.message || String(error))));
  return {
    state,
    stop: () => unsubs.forEach((unsub) => {
      try { unsub(); } catch {}
    }),
  };
}

async function collectDbState(db, channel) {
  const normalizedChannel = normalizeChannel(channel);
  const [participationSnap, namesSnap, commentsSnap] = await Promise.all([
    get(ref(db, participationPath(normalizedChannel))),
    get(ref(db, `nameShouts/${normalizedChannel}`)),
    get(ref(db, `supporterComments/${normalizedChannel}`)),
  ]);
  const participation = participationSnap.val() || {};
  const swipes = participation.swipes || {};
  const counts = Object.values(swipes)
    .map((event) => Number(event?.count))
    .filter((count) => Number.isFinite(count));
  const duplicateCounts = [...new Set(counts.filter((count, index) => counts.indexOf(count) !== index))].sort((a, b) => a - b);
  const maxCount = counts.length ? Math.max(...counts) : 0;
  const missingCounts = [];
  for (let i = 1; i <= maxCount; i += 1) {
    if (!counts.includes(i)) missingCounts.push(i);
  }
  let nameCount = 0;
  namesSnap.forEach((child) => {
    if (child.val()?.type === "name-announced") nameCount += 1;
  });
  let commentCount = 0;
  commentsSnap.forEach((child) => {
    if (child.val()?.type === "supporter-comment") commentCount += 1;
  });
  return {
    channel: normalizedChannel,
    participantCount: Number(participation.participantCount) || 0,
    swipeCount: Object.keys(swipes).length,
    countMin: counts.length ? Math.min(...counts) : 0,
    countMax: maxCount,
    duplicateCounts,
    missingCounts,
    nameShoutsCount: nameCount,
    supporterCommentsCount: commentCount,
  };
}

async function runTimedWrites({ db, total, spreadMs, channel, scenarioName, includeNames, includeComments }) {
  const tasks = [];
  const startedAt = performance.now();
  for (let index = 0; index < total; index += 1) {
    const delay = total <= 1 ? 0 : Math.round((spreadMs * index) / (total - 1));
    tasks.push((async () => {
      await sleep(delay);
      const [swipe, name, comment] = await Promise.all([
        publishSwipe(db, { index, channel, scenarioName }),
        includeNames ? publishName(db, { index, channel, scenarioName }) : Promise.resolve(null),
        includeComments ? publishComment(db, { index, channel, scenarioName }) : Promise.resolve(null),
      ]);
      return { index, delay, swipe, name, comment };
    })());
  }
  const records = await Promise.all(tasks);
  return { records, wallMs: performance.now() - startedAt };
}

function summarizeRecords(records) {
  const swipes = records.map((record) => record.swipe);
  const okSwipes = swipes.filter((swipe) => swipe.ok);
  const latencies = okSwipes.map((swipe) => swipe.latencyMs);
  const retryCounts = okSwipes.map((swipe) => swipe.retryCount);
  const writeRetryCounts = okSwipes.map((swipe) => swipe.writeRetryCount || 0);
  const nameWrites = records.map((record) => record.name).filter(Boolean);
  const commentWrites = records.map((record) => record.comment).filter(Boolean);
  const errors = swipes.filter((swipe) => !swipe.ok).map((swipe) => ({ code: swipe.errorCode, message: swipe.error }));
  return {
    swipeSuccess: okSwipes.length,
    swipeFailed: swipes.length - okSwipes.length,
    transactionRetryTotal: retryCounts.reduce((sum, value) => sum + value, 0),
    transactionRetryMax: retryCounts.length ? Math.max(...retryCounts) : 0,
    transactionRetryAvg: retryCounts.length ? round(retryCounts.reduce((sum, value) => sum + value, 0) / retryCounts.length) : 0,
    writeRetryTotal: writeRetryCounts.reduce((sum, value) => sum + value, 0),
    writeRetryMax: writeRetryCounts.length ? Math.max(...writeRetryCounts) : 0,
    p50ConfirmMs: round(percentile(latencies, 50)),
    p95ConfirmMs: round(percentile(latencies, 95)),
    maxConfirmMs: round(latencies.length ? Math.max(...latencies) : 0),
    nameWriteSuccess: nameWrites.filter((entry) => entry.ok).length,
    nameWriteFailed: nameWrites.filter((entry) => !entry.ok).length,
    commentWriteSuccess: commentWrites.filter((entry) => entry.ok).length,
    commentWriteFailed: commentWrites.filter((entry) => !entry.ok).length,
    sampleErrors: errors.slice(0, 5),
  };
}

async function runScenario(definition) {
  await resetEmulatorDb();
  const { app: writerApp, db: writerDb } = createAppDb(`writer-${definition.name}`);
  const { app: observerApp, db: observerDb } = createAppDb(`observer-${definition.name}`);
  const watcher = watchDooh(observerDb, definition.channel);
  await sleep(500);
  const { records, wallMs } = await runTimedWrites({
    db: writerDb,
    total: definition.total,
    spreadMs: definition.spreadMs,
    channel: definition.channel,
    scenarioName: definition.name,
    includeNames: definition.includeNames,
    includeComments: definition.includeComments,
  });
  await sleep(definition.settleMs ?? 2000);
  const dbState = await collectDbState(observerDb, definition.channel);
  const summary = summarizeRecords(records);
  const result = {
    name: definition.name,
    description: definition.description,
    channel: definition.channel,
    total: definition.total,
    spreadMs: definition.spreadMs,
    includeNames: definition.includeNames,
    includeComments: definition.includeComments,
    wallMs: round(wallMs),
    summary,
    dbState,
    doohSubscription: watcher.state,
    rawRecordSample: records.slice(0, 3),
    passed: summary.swipeSuccess === definition.total
      && summary.swipeFailed === 0
      && dbState.participantCount === definition.total
      && dbState.swipeCount === definition.total
      && dbState.duplicateCounts.length === 0
      && dbState.missingCounts.length === 0
      && (!definition.includeNames || dbState.nameShoutsCount === definition.total)
      && (!definition.includeComments || dbState.supporterCommentsCount === definition.total),
  };
  watcher.stop();
  await Promise.allSettled([deleteApp(writerApp), deleteApp(observerApp)]);
  return result;
}

async function runChannelIsolation() {
  await resetEmulatorDb();
  const { app: writerApp, db: writerDb } = createAppDb("writer-isolation");
  const { app: observerApp, db: observerDb } = createAppDb("observer-isolation");
  const defaultWatcher = watchDooh(observerDb, "default");
  const youtubeWatcher = watchDooh(observerDb, "youtube");
  await sleep(500);
  const [normalRecords, youtubeRecords, youtubeName, youtubeComment] = await Promise.all([
    runTimedWrites({ db: writerDb, total: 30, spreadMs: 1000, channel: "default", scenarioName: "channel-isolation-default", includeNames: true, includeComments: true }),
    runTimedWrites({ db: writerDb, total: 30, spreadMs: 1000, channel: "youtube", scenarioName: "channel-isolation-youtube", includeNames: false, includeComments: false }),
    publishName(writerDb, { index: 0, channel: "youtube", scenarioName: "channel-isolation-youtube-block-check" }),
    publishComment(writerDb, { index: 0, channel: "youtube", scenarioName: "channel-isolation-youtube-block-check" }),
  ]);
  await sleep(2000);
  const [defaultState, youtubeState] = await Promise.all([
    collectDbState(observerDb, "default"),
    collectDbState(observerDb, "youtube"),
  ]);
  const result = {
    name: "channel-isolation",
    description: "通常Demo(default)とYouTube(youtube)のDBチャンネルが混ざらないか。YouTubeのname/comment書き込みはルールで拒否されることも確認。",
    defaultSummary: summarizeRecords(normalRecords.records),
    youtubeSummary: summarizeRecords(youtubeRecords.records),
    defaultState,
    youtubeState,
    defaultDoohSubscription: defaultWatcher.state,
    youtubeDoohSubscription: youtubeWatcher.state,
    youtubeNameWriteBlocked: !youtubeName.ok,
    youtubeCommentWriteBlocked: !youtubeComment.ok,
    youtubeNameError: youtubeName.ok ? null : { code: youtubeName.errorCode, message: youtubeName.error },
    youtubeCommentError: youtubeComment.ok ? null : { code: youtubeComment.errorCode, message: youtubeComment.error },
  };
  result.passed = result.defaultSummary.swipeSuccess === 30
    && result.youtubeSummary.swipeSuccess === 30
    && defaultState.participantCount === 30
    && youtubeState.participantCount === 30
    && defaultState.nameShoutsCount === 30
    && defaultState.supporterCommentsCount === 30
    && youtubeState.nameShoutsCount === 0
    && youtubeState.supporterCommentsCount === 0
    && result.youtubeNameWriteBlocked
    && result.youtubeCommentWriteBlocked;
  defaultWatcher.stop();
  youtubeWatcher.stop();
  await Promise.allSettled([deleteApp(writerApp), deleteApp(observerApp)]);
  return result;
}

async function runDedupeCheck() {
  await resetEmulatorDb();
  const { app, db } = createAppDb("writer-dedupe");
  await sleep(500);
  // 同一visitorが「完全同時」に2回スワイプ×10人。
  // 2回目は dailyParticipants の !data.exists() でupdate全体が原子的に拒否され、
  // participantCount が二重加算されないことを確認する。
  const tasks = [];
  for (let index = 0; index < 10; index += 1) {
    tasks.push(publishSwipe(db, { index, channel: "default", scenarioName: "dedupe" }));
    tasks.push(publishSwipe(db, { index, channel: "default", scenarioName: "dedupe" }));
  }
  const records = await Promise.all(tasks);
  await sleep(1500);
  const state = await collectDbState(db, "default");
  const accepted = records.filter((record) => record.ok).length;
  const duplicates = records.filter((record) => record.duplicate).length;
  const result = {
    name: "dedupe-atomic",
    description: "同一visitorの完全同時二重スワイプ×10人。2回目はrulesで原子的に拒否され二重カウントされないこと。",
    accepted,
    duplicates,
    dbState: state,
    sampleErrors: records.filter((record) => !record.ok && !record.duplicate).slice(0, 5)
      .map((record) => ({ code: record.errorCode, message: record.error })),
    passed: accepted === 10
      && duplicates === 10
      && state.participantCount === 10
      && state.swipeCount === 10,
  };
  await Promise.allSettled([deleteApp(app)]);
  return result;
}

function formatMarkdown(results) {
  const lines = [];
  lines.push("# DOOH Realtime Database Load Test Results");
  lines.push("");
  lines.push(`- Date: ${new Date().toISOString()}`);
  lines.push(`- Project/namespace: ${PROJECT_ID} / ${NS}`);
  lines.push(`- Emulator: ${DB_HOST}:${DB_PORT}`);
  lines.push(`- Rules: database.rules.json via Firebase Emulator`);
  lines.push("");
  lines.push("| Scenario | Channel | Success/Fail | Final participantCount | Swipe rows | Dup | Missing | Tx retry total / max / avg | p50 / p95 / max confirm ms | nameShouts | comments | DOOH count updates | DOOH swipe events | Pass |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const result of results) {
    if (result.name === "channel-isolation") {
      for (const row of [
        ["channel-isolation default", "default", result.defaultSummary, result.defaultState, result.defaultDoohSubscription],
        ["channel-isolation youtube", "youtube", result.youtubeSummary, result.youtubeState, result.youtubeDoohSubscription],
      ]) {
        const [name, channel, summary, state, sub] = row;
        lines.push(`| ${name} | ${channel} | ${summary.swipeSuccess}/${summary.swipeFailed} | ${state.participantCount} | ${state.swipeCount} | ${state.duplicateCounts.length} | ${state.missingCounts.length} | ${summary.transactionRetryTotal} / ${summary.transactionRetryMax} / ${summary.transactionRetryAvg} | ${summary.p50ConfirmMs} / ${summary.p95ConfirmMs} / ${summary.maxConfirmMs} | ${state.nameShoutsCount} | ${state.supporterCommentsCount} | ${sub.participantCountUpdates} | ${sub.swipeChildAdded} | ${result.passed ? "OK" : "NG"} |`);
      }
    } else if (result.name === "dedupe-atomic") {
      lines.push(`| dedupe-atomic | default | ${result.accepted}/${result.duplicates} dup-rejected | ${result.dbState.participantCount} | ${result.dbState.swipeCount} | - | - | - | - | - | - | - | - | ${result.passed ? "OK" : "NG"} |`);
    } else {
      const s = result.summary;
      const d = result.dbState;
      const sub = result.doohSubscription;
      lines.push(`| ${result.name} | ${result.channel} | ${s.swipeSuccess}/${s.swipeFailed} | ${d.participantCount} | ${d.swipeCount} | ${d.duplicateCounts.length} | ${d.missingCounts.length} | ${s.transactionRetryTotal} / ${s.transactionRetryMax} / ${s.transactionRetryAvg} | ${s.p50ConfirmMs} / ${s.p95ConfirmMs} / ${s.maxConfirmMs} | ${d.nameShoutsCount} | ${d.supporterCommentsCount} | ${sub.participantCountUpdates} | ${sub.swipeChildAdded} | ${result.passed ? "OK" : "NG"} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

const SCENARIOS = [
  {
    name: "simultaneous-1000",
    description: "1000人が完全同時にスワイプ。nameShouts/supporterCommentsも1000件同時作成。",
    total: 1000,
    spreadMs: 0,
    channel: "default",
    includeNames: true,
    includeComments: true,
    settleMs: 5000,
  },
  {
    name: "spread-30s-1000",
    description: "1000人が30秒に分散してスワイプ。",
    total: 1000,
    spreadMs: 30_000,
    channel: "default",
    includeNames: true,
    includeComments: true,
    settleMs: 5000,
  },
  {
    name: "spread-120s-1000",
    description: "1000人が2分に分散してスワイプ。",
    total: 1000,
    spreadMs: 120_000,
    channel: "default",
    includeNames: true,
    includeComments: true,
    settleMs: 5000,
  },
  {
    name: "simultaneous-300",
    description: "300人が完全同時にスワイプ。nameShouts/supporterCommentsも300件同時作成。",
    total: 300,
    spreadMs: 0,
    channel: "default",
    includeNames: true,
    includeComments: true,
    settleMs: 3000,
  },
  {
    name: "spread-30s-300",
    description: "300人が30秒に分散してスワイプ。",
    total: 300,
    spreadMs: 30_000,
    channel: "default",
    includeNames: true,
    includeComments: true,
    settleMs: 3000,
  },
  {
    name: "spread-120s-300",
    description: "300人が2分に分散してスワイプ。",
    total: 300,
    spreadMs: 120_000,
    channel: "default",
    includeNames: true,
    includeComments: true,
    settleMs: 3000,
  },
  {
    name: "school-50-short",
    description: "学校デモ想定: 50人が5秒に分散してアクセス/スワイプ。",
    total: 50,
    spreadMs: 5_000,
    channel: "default",
    includeNames: true,
    includeComments: true,
    settleMs: 2000,
  },
];

async function main() {
  const args = parseArgs(process.argv);
  const scenarioName = args.get("scenario") || "all";
  await mkdir(OUT_DIR, { recursive: true });
  const started = new Date().toISOString().replace(/[:.]/g, "-");
  const selected = scenarioName === "all"
    ? SCENARIOS
    : SCENARIOS.filter((scenario) => scenario.name === scenarioName);
  if (scenarioName !== "all" && scenarioName !== "channel-isolation" && scenarioName !== "dedupe-atomic" && selected.length === 0) {
    throw new Error(`Unknown scenario: ${scenarioName}`);
  }
  const results = [];
  for (const scenario of selected) {
    console.log(`\n[load-test] ${scenario.name} start`);
    const result = await runScenario(scenario);
    results.push(result);
    console.log(`[load-test] ${scenario.name} ${result.passed ? "OK" : "NG"}`, result.summary, result.dbState);
  }
  if (scenarioName === "all" || scenarioName === "channel-isolation") {
    console.log("\n[load-test] channel-isolation start");
    const result = await runChannelIsolation();
    results.push(result);
    console.log(`[load-test] channel-isolation ${result.passed ? "OK" : "NG"}`);
  }
  if (scenarioName === "all" || scenarioName === "dedupe-atomic") {
    console.log("\n[load-test] dedupe-atomic start");
    const result = await runDedupeCheck();
    results.push(result);
    console.log(`[load-test] dedupe-atomic ${result.passed ? "OK" : "NG"}`, { accepted: result.accepted, duplicates: result.duplicates, participantCount: result.dbState.participantCount });
  }
  const jsonPath = `${OUT_DIR}/dooh-load-results-${started}.json`;
  const mdPath = `${OUT_DIR}/dooh-load-results-${started}.md`;
  await writeFile(jsonPath, JSON.stringify({ projectId: PROJECT_ID, namespace: NS, dbHost: DB_HOST, dbPort: DB_PORT, results }, null, 2));
  await writeFile(mdPath, formatMarkdown(results));
  console.log(`\n[load-test] wrote ${jsonPath}`);
  console.log(`[load-test] wrote ${mdPath}`);
}

main().catch((error) => {
  console.error("[load-test] failed", error);
  process.exitCode = 1;
});
