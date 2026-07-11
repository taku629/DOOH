# DOOH参加型Webプロトタイプ 負荷テスト手順

本番DBを汚さないため、必ず Firebase Realtime Database Emulator で実行します。`firebase.json` の `database.rules.json` が読み込まれます。

## DB負荷テスト

全シナリオ:

```bash
firebase emulators:exec --only database --project demo-dooh-load-test --config firebase.loadtest.json "node scripts/dooh-load-test.mjs --scenario all"
```

個別実行:

```bash
firebase emulators:exec --only database --project demo-dooh-load-test --config firebase.loadtest.json "node scripts/dooh-load-test.mjs --scenario simultaneous-300"
firebase emulators:exec --only database --project demo-dooh-load-test --config firebase.loadtest.json "node scripts/dooh-load-test.mjs --scenario spread-30s-300"
firebase emulators:exec --only database --project demo-dooh-load-test --config firebase.loadtest.json "node scripts/dooh-load-test.mjs --scenario spread-120s-300"
firebase emulators:exec --only database --project demo-dooh-load-test --config firebase.loadtest.json "node scripts/dooh-load-test.mjs --scenario school-50-short"
firebase emulators:exec --only database --project demo-dooh-load-test --config firebase.loadtest.json "node scripts/dooh-load-test.mjs --scenario channel-isolation"
firebase emulators:exec --only database --project demo-dooh-load-test --config firebase.loadtest.json "node scripts/dooh-load-test.mjs --scenario dedupe-atomic"
```

書き込みは本番クライアント（`src/firebase-bridge.js` の `publishSwipeComplete`）と同じ
「participantHistory/dailyParticipants をread → `increment(1)`＋swipe本体の多パスupdate」方式を再現します
（2026-07-08 に親ノードtransactionから移行。完全同時アクセスでCAS競合が起きない設計）。
`dedupe-atomic` は同一visitorの完全同時二重スワイプが rules の `!data.exists()` で
原子的に拒否され、participantCount が二重加算されないことを確認します。

結果は `artifacts/load-test/dooh-load-results-*.json` と `.md` に保存されます。

## DOOH動画スモーク/耐久テスト

実動画3本を `demo.html?manual&fast&debug` で読み込み、headless Chromium の Chrome DevTools Protocol で再生状態を監視します。

```bash
# 通常の60秒アイドル待機で検証
node scripts/dooh-video-smoke.mjs

# 開発時に短時間で確認したい場合のみ（60秒待機を6秒へ短縮）
node scripts/dooh-video-smoke.mjs --fast
```

結果は `artifacts/load-test/dooh-video-results-*.json` に保存されます。

## 注意

- `FIREBASE_DATABASE_EMULATOR_HOST` が無い場合は `127.0.0.1:9000` を使います。
- `FIREBASE_DATABASE_EMULATOR_NAMESPACE` が無い場合は Firebase Emulator の既定RTDB namespaceである `demo-dooh-load-test-default-rtdb` を使います。
- headless Chromium がH.264/mp4を再生できない環境では、同解像度・同fps・近いビットレートのWebMに変換してから再検証してください。この環境のスクリプトはまず `canPlayType()` と実再生でMP4可否を記録します。
