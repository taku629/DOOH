# Database Design

DOOH 画面とスマートフォン参加画面を別端末で同期するための Firebase Realtime Database 設計。現行実装に合わせた `v1` と、イベント本番運用に拡張する場合の `v2` を分けて定義する。

## Goals

- 参加完了を DOOH 画面へリアルタイム通知する
- 累計参加数をリロード後も保持する
- 複数端末から同時参加しても参加数を取りこぼさない
- クライアントだけで動く静的サイト構成を維持する
- 個人情報を保存しない
- 将来、会場・日付・セッション単位の集計に拡張できる余地を残す

## Non-Goals

- 厳密な本人確認
- 完全な不正参加防止
- 管理画面
- サーバーサイド集計基盤
- 長期的なユーザー行動分析

## Current Architecture

```text
Smartphone participant page
  └─ publishSwipeComplete()
      ├─ transaction: stats/participantCount += 1
      └─ push: swipes/{eventId}

DOOH display page
  ├─ subscribeToParticipantCount()
  │   └─ onValue(stats/participantCount)
  └─ subscribeToSwipeCompletes()
      └─ onChildAdded(swipes)
```

現行コードでは Firebase Realtime Database を CDN 経由で読み込み、`config/firebase-config.json` が有効な場合だけクロス端末同期を有効にする。Firebase が無効な場合は、同一オリジン内の `localStorage` / `BroadcastChannel` 連携にフォールバックする。

## v1 Schema

現行実装で使う最小スキーマ。

```text
/
├── stats
│   └── participantCount: number
└── swipes
    └── {eventId}
        ├── type: "swipe-completed"
        ├── createdAt: number
        ├── count: number
        ├── name: string | null
        └── userAgent: string | null
```

### `stats`

集計値を保持する。

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| `stats/participantCount` | number | yes | 累計参加数。参加完了ごとに `+1` する |

Rules:

- `runTransaction()` でのみ増加させる
- 未作成時は `0` とみなし、最初の参加で `1` にする
- 手動リセット時は Firebase Console で `0` を入れるか `stats` を削除する
- クライアントから任意の値へ上書きできないよう Security Rules で `+1` のみ許可する

### `swipes`

参加完了イベントを append-only に近い形で保存する。DOOH 画面は新規イベントを購読し、受信時に参加演出へ切り替える。

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | string | yes | `"swipe-completed"` 固定 |
| `createdAt` | number | yes | Firebase `serverTimestamp()` |
| `count` | number | yes | イベント発生後の累計参加数 |
| `name` | string \| null | no | 表示名。現状は基本 `null` |
| `userAgent` | string \| null | no | デバッグ用。不要なら削除候補 |

Example:

```json
{
  "type": "swipe-completed",
  "createdAt": 1715662800123,
  "count": 12,
  "name": null,
  "userAgent": "Mozilla/5.0 (iPhone; ...)"
}
```

## Write Flow

1. 参加者がスマートフォン画面でスワイプを 100% まで進める
2. 「完了して次へ」を押す
3. `stats/participantCount` を transaction で `+1` する
4. transaction 後の値を `count` として取得する
5. `swipes/{eventId}` に参加完了イベントを書き込む
6. スマートフォン側の `localStorage` に参加済みフラグを保存する

`stats/participantCount` と `swipes/{eventId}` は完全な単一トランザクションではない。現行の優先度は「カウントの正確性」で、イベント書き込みに失敗した場合はカウントだけ進む可能性がある。発表デモ用途では許容し、より厳密にする場合は Cloud Functions か `v2` の `events` 中心設計に移行する。

## Read Flow

### Smartphone

- 初期表示時に `stats/participantCount` を読む
- 参加済み端末では再加算せず、参加済み状態として表示する
- Firebase が無効な場合はローカルのフォールバック値で表示する

### DOOH Display

- `stats/participantCount` を `onValue()` で購読する
- `swipes` を `onChildAdded()` で購読する
- 初回購読時に既存イベント ID を記録し、過去イベントで演出を発火しない
- 新規 `swipe-completed` だけを参加演出のトリガーにする

## Consistency Model

| Concern | v1 Policy |
| --- | --- |
| 同時参加 | `stats/participantCount` の transaction で加算競合を防ぐ |
| イベント順序 | Firebase push ID と `createdAt` を併用する |
| 重複カウント | 同一ブラウザでは `localStorage` で抑止する |
| 別端末重複 | v1 では許容する |
| 過去イベント再生 | DOOH 側で購読開始時の既存 ID を無視する |
| カウント成功後のイベント失敗 | v1 では許容する。必要なら Cloud Functions 化する |

## Security Rules

公開クライアントから直接 Realtime Database に書くため、Firebase config は秘密情報として扱わない。制御は Security Rules で行う。

### v1 Rules

```json
{
  "rules": {
    "stats": {
      "participantCount": {
        ".read": true,
        ".write": "newData.isNumber() && newData.val() === (data.exists() ? data.val() + 1 : 1)"
      }
    },
    "swipes": {
      ".read": true,
      "$eventId": {
        ".write": "!data.exists() && newData.hasChildren(['type', 'createdAt', 'count'])",
        ".validate": "newData.child('type').val() === 'swipe-completed' && newData.child('count').isNumber() && newData.child('count').val() > 0"
      }
    }
  }
}
```

この Rules は「最低限の形」を縛るもの。`createdAt` が `serverTimestamp()` かどうかや、`count` が直前の `participantCount` と一致するかまでは Realtime Database Rules だけでは厳密に保証しにくい。

### Hardening Options

- App Check を有効化して、許可したWebアプリ以外からの書き込みを減らす
- `userAgent` を保存しない設定にして、データ最小化を徹底する
- Cloud Functions で「イベント作成」と「カウント加算」をサーバー側に集約する
- イベント当日だけ書き込みを許可し、終了後は read-only に切り替える

## Operations

### 初期化

公開前に Firebase Console で以下のどちらかを実行する。

- `stats/participantCount` を `0` にする
- `stats` と `swipes` を削除する

### リセット

発表リハーサル後に本番値へ戻す場合:

1. `stats/participantCount` を `0` にする
2. `swipes` を削除する
3. DOOH 表示画面をリロードする

### 監視

最低限、Firebase Console で以下を見る。

- `stats/participantCount` が増えているか
- `swipes` に新規イベントが追加されているか
- 不自然に短時間で大量のイベントが増えていないか

### データ保持

デモ用途では、イベント終了後に `swipes` を削除してよい。集計として残す必要がある場合も、個人識別につながりうる `userAgent` は削除対象にする。

## v2 Schema

イベント日・会場・複数回実施に対応する場合の拡張案。すぐには実装しない。

```text
/
├── activeSessionId: string
├── sessions
│   └── {sessionId}
│       ├── title: string
│       ├── venue: string | null
│       ├── startedAt: number
│       ├── endedAt: number | null
│       ├── status: "draft" | "live" | "closed"
│       └── participantCount: number
├── events
│   └── {sessionId}
│       └── {eventId}
│           ├── type: "swipe-completed"
│           ├── createdAt: number
│           ├── countAfter: number
│           ├── clientId: string | null
│           └── source: "participant-page"
└── participantDevices
    └── {sessionId}
        └── {clientId}
            ├── firstParticipatedAt: number
            ├── lastParticipatedAt: number
            └── eventId: string
```

### v2 Design Notes

- `activeSessionId` で現在の発表・会場を切り替える
- 集計値は `sessions/{sessionId}/participantCount` に寄せる
- イベント履歴は `events/{sessionId}` に分け、過去セッションのイベントをDOOHが誤受信しないようにする
- `participantDevices` は匿名 `clientId` による簡易重複防止に使う
- `clientId` はブラウザの `localStorage` で生成する UUID 程度に留め、個人識別子は使わない

## Migration Path

`v1` から `v2` へ移行する場合:

1. `sessions/{sessionId}` と `activeSessionId` を作る
2. 参加ページが起動時に `activeSessionId` を読む
3. `stats/participantCount` の代わりに `sessions/{sessionId}/participantCount` を transaction で加算する
4. `swipes` の代わりに `events/{sessionId}` へ書き込む
5. DOOH 画面の購読先を `events/{sessionId}` に変更する
6. 問題なければ `stats` と `swipes` を読み取り専用または削除対象にする

## Implementation Mapping

| Code | Current DB Path | Responsibility |
| --- | --- | --- |
| `src/firebase-bridge.js` | `stats/participantCount`, `swipes` | Firebase 初期化、参加数更新、イベント購読 |
| `publishSwipeComplete()` | `stats/participantCount`, `swipes/{eventId}` | 参加完了の書き込み |
| `getParticipantCount()` | `stats/participantCount` | 参加ページ初期表示の人数取得 |
| `subscribeToParticipantCount()` | `stats/participantCount` | DOOH 側の人数表示更新 |
| `subscribeToSwipeCompletes()` | `swipes` | DOOH 側の参加演出トリガー |
| `web/participant-flow.js` | localStorage + Firebase | 参加済み判定、完了操作、表示更新 |
| `src/player.js` | Firebase subscriptions | 参加数表示、参加演出動画への切り替え |

## Recommended Next Steps

1. 発表デモまでは `v1` のまま運用する
2. Firebase Console に `v1 Rules` を設定する
3. 本番直前に `stats` と `swipes` をリセットする
4. 実施回を分ける必要が出たら `v2` の session 分離へ移行する
5. 不正書き込みを問題にする段階で App Check または Cloud Functions を導入する
