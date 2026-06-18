// 既存の参加データに totalDays（通算参加日数）を遡って埋めるバックフィル。
// visitorId ごとに participationDate のユニーク数を数え、
//   - 各 swipe には「その日までの累積ユニーク日数」を totalDays として書き込む
//   - participantHistory[visitorId].totalDays には最終的な通算日数を書き込む
// デフォルトはドライラン（集計のみ）。実反映は: node scripts/backfill-total-days.mjs --apply
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PROJECT = "dooh-ca9c2";
const APPLY = process.argv.includes("--apply");
// チャンネル名（RTDBルートのパス）。V2 は visitorId/date を持たない古い形式なので対象外。
const CHANNELS = ["participation", "participationResearch"];

function loadJson(path) {
    try {
        const raw = JSON.parse(readFileSync(path, "utf8"));
        return raw && typeof raw === "object" ? raw : {};
    } catch {
        return {};
    }
}

const updates = {};        // RTDBパス -> 書き込む値
const summary = [];

for (const channel of CHANNELS) {
    const swipes = loadJson(`/tmp/sw_${channel}.json`);
    const history = loadJson(`/tmp/ph_${channel}.json`);

    // visitorId ごとに swipe をまとめる
    const byVisitor = new Map();
    for (const [key, swipe] of Object.entries(swipes)) {
        if (!swipe || typeof swipe !== "object") continue;
        const visitorId = swipe.visitorId;
        const date = swipe.participationDate;
        if (!visitorId || !date) continue;
        if (!byVisitor.has(visitorId)) byVisitor.set(visitorId, []);
        byVisitor.get(visitorId).push({ key, date });
    }

    for (const [visitorId, rows] of byVisitor.entries()) {
        rows.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
        // 日付ごとの累積ユニーク数を割り当てる（同日重複は同じ totalDays）
        const seenDates = new Set();
        for (const row of rows) {
            seenDates.add(row.date);
            const cumulative = seenDates.size;
            const path = `${channel}/swipes/${row.key}/totalDays`;
            // 既に正しい値が入っていれば書き込み不要
            if (Number(swipes[row.key].totalDays) !== cumulative) {
                updates[path] = cumulative;
            }
        }
        const totalDays = seenDates.size;
        // participantHistory が存在する場合のみ totalDays を補完（無い場合は swipe フォールバックで足りる）
        if (history[visitorId] && Number(history[visitorId].totalDays) !== totalDays) {
            updates[`${channel}/participantHistory/${visitorId}/totalDays`] = totalDays;
        }
        summary.push({ channel, visitorId, totalDays, swipeCount: rows.length });
    }
}

summary.sort((a, b) => b.totalDays - a.totalDays);
console.log(`対象チャンネル: ${CHANNELS.join(", ")}`);
console.log(`対象 visitor 数: ${summary.length}`);
console.log(`書き込み予定パス数: ${Object.keys(updates).length}`);
console.log("\n通算日数 上位:");
summary.slice(0, 15).forEach((s) =>
    console.log(`  ${s.totalDays}日  ${s.visitorId}  (swipe ${s.swipeCount}件) [${s.channel}]`)
);

const dist = {};
summary.forEach((s) => { dist[s.totalDays] = (dist[s.totalDays] || 0) + 1; });
console.log("\n通算日数分布(日数:人数):", JSON.stringify(dist));

writeFileSync("/tmp/backfill-updates.json", JSON.stringify(updates, null, 2));
console.log("\n更新内容を /tmp/backfill-updates.json に書き出しました。");

if (!APPLY) {
    console.log("\n*** ドライラン *** 書き込みは行っていません。反映するには --apply を付けて実行してください。");
} else {
    console.log("\n=== 本番反映します ===");
    execFileSync(
        "firebase",
        ["database:update", "/", "/tmp/backfill-updates.json", "--project", PROJECT, "--force"],
        { stdio: "inherit" }
    );
    console.log("反映完了。");
}
