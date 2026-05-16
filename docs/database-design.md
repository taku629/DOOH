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
      └─ transaction: participation
          ├─ participantCount += 1
          └─ swipes/{eventId} = swipe-completed

DOOH display page
  ├─ subscribeToParticipantCount()
  │   └─ onValue(participation/participantCount)
  └─ subscribeToSwipeCompletes()
      └─ onChildAdded(participation/swipes)
```

現行コードでは Firebase Realtime Database を CDN 経由で読み込み、`config/firebase-config.json` が有効な場合だけクロス端末同期を有効にする。Firebase が無効な場合は、同一オリジン内の `localStorage` / `BroadcastChannel` 連携にフォールバックする。

## v1 Schema

現行実装で使う最小スキーマ。

```text
/
└── participation
    ├── participantCount: number
    └── swipes
        └── {eventId}
            ├── type: "swipe-completed"
            ├── createdAt: number
            ├── count: number
            ├── name: string | null
            └── userAgent: string | null
```

### `participation`

参加集計と参加完了イベントを同じ transaction 境界に置く。これにより、複数人が同時に参加しても `participantCount` が競合で上書きされず、カウント加算とイベント作成も同じコミットとして扱える。

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| `participation/participantCount` | number | yes | 累計参加数。参加完了ごとに `+1` する |
| `participation/swipes/{eventId}` | object | yes | 参加完了イベント |

Rules:

- `participation` を `runTransaction()` で更新する
- 未作成時は `0` とみなし、最初の参加で `1` にする
- 手動リセット時は Firebase Console で `0` を入れるか `participation` を削除する
- 旧スキーマの `stats/participantCount` は参照しない。移行時は `participation/participantCount` に値を手動で入れる

### `participation/swipes`

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
3. `participation/swipes/{eventId}` 用の push ID を先に生成する
4. `participation` を transaction で読む
5. `participantCount` を `+1` し、同じ戻り値の中で `swipes/{eventId}` を追加する
6. transaction 後の `participantCount` を画面表示に反映する
7. スマートフォン側の `localStorage` に参加済みフラグを保存する

この方式では同時参加が来ても Firebase が transaction を再試行するため、最終的な `participantCount` は `1, 2, 3...` と加算される。カウントとイベントは同じ `participation` transaction に含まれるため、「人数だけ増えてイベントがない」状態も起きにくい。

注意点として、`participation` 配下のイベント履歴も transaction 対象になる。大量イベントを長期間保存する用途では効率が落ちるため、本番運用で参加数が大きくなる場合は Cloud Functions でサーバー側集計に移す。

## Read Flow

### Smartphone

- 初期表示時に `participation/participantCount` を読む
- 参加済み端末では再加算せず、参加済み状態として表示する
- Firebase が無効な場合はローカルのフォールバック値で表示する

### DOOH Display

- `participation/participantCount` を `onValue()` で購読する
- `participation/swipes` を `onChildAdded()` で購読する
- 初回購読時に既存イベント ID を記録し、過去イベントで演出を発火しない
- 新規 `swipe-completed` だけを参加演出のトリガーにする

## Consistency Model

| Concern | v1 Policy |
| --- | --- |
| 同時参加 | `participation` transaction で加算競合を防ぐ |
| イベント順序 | Firebase push ID と `createdAt` を併用する |
| 重複カウント | 同一ブラウザでは `localStorage` で抑止する |
| 別端末重複 | v1 では許容する |
| 過去イベント再生 | DOOH 側で購読開始時の既存 ID を無視する |
| カウントとイベントのズレ | 同じ `participation` transaction に入れて抑止する |

## Security Rules

公開クライアントから直接 Realtime Database に書くため、Firebase config は秘密情報として扱わない。制御は Security Rules で行う。

### v1 Rules

```json
{
  "rules": {
    "participation": {
      ".read": true,
      ".write": "newData.child('participantCount').isNumber() && newData.child('participantCount').val() === (data.child('participantCount').exists() ? data.child('participantCount').val() + 1 : 1)",
      "participantCount": {
        ".validate": "newData.isNumber()"
      },
      "swipes": {
        "$eventId": {
          ".validate": "newData.hasChildren(['type', 'createdAt', 'count']) && newData.child('type').val() === 'swipe-completed' && newData.child('count').isNumber() && newData.child('count').val() > 0"
        }
      }
    }
  }
}
```

この Rules は `participantCount` が1ずつ増える更新だけを許可する。`swipes/{eventId}` の `count` と `participantCount` の一致まで厳密に検証したい場合は、Cloud Functions でサーバー側に書き込みを集約する。

### Hardening Options

- App Check を有効化して、許可したWebアプリ以外からの書き込みを減らす
- `userAgent` を保存しない設定にして、データ最小化を徹底する
- Cloud Functions で「イベント作成」と「カウント加算」をサーバー側に集約する
- イベント当日だけ書き込みを許可し、終了後は read-only に切り替える

## Operations

### 初期化

公開前に Firebase Console で以下のどちらかを実行する。

- `participation/participantCount` を `0` にする
- `participation` を削除する

### リセット

発表リハーサル後に本番値へ戻す場合:

1. `participation/participantCount` を `0` にする
2. `participation/swipes` を削除する
3. DOOH 表示画面をリロードする

### 監視

最低限、Firebase Console で以下を見る。

- `participation/participantCount` が増えているか
- `participation/swipes` に新規イベントが追加されているか
- 不自然に短時間で大量のイベントが増えていないか

### データ保持

デモ用途では、イベント終了後に `participation/swipes` を削除してよい。集計として残す必要がある場合も、個人識別につながりうる `userAgent` は削除対象にする。

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
3. `participation/participantCount` の代わりに `sessions/{sessionId}/participantCount` を transaction で加算する
4. `participation/swipes` の代わりに `events/{sessionId}` へ書き込む
5. DOOH 画面の購読先を `events/{sessionId}` に変更する
6. 問題なければ `participation` を読み取り専用または削除対象にする

## Implementation Mapping

| Code | Current DB Path | Responsibility |
| --- | --- | --- |
| `src/firebase-bridge.js` | `participation/participantCount`, `participation/swipes` | Firebase 初期化、参加数更新、イベント購読 |
| `publishSwipeComplete()` | `participation` | 参加完了の transaction 書き込み |
| `getParticipantCount()` | `participation/participantCount` | 参加ページ初期表示の人数取得 |
| `subscribeToParticipantCount()` | `participation/participantCount` | DOOH 側の人数表示更新 |
| `subscribeToSwipeCompletes()` | `participation/swipes` | DOOH 側の参加演出トリガー |
| `web/participant-flow.js` | localStorage + Firebase | 参加済み判定、完了操作、表示更新 |
| `src/player.js` | Firebase subscriptions | 参加数表示、参加演出動画への切り替え |

## Recommended Next Steps

1. 発表デモまでは `v1` のまま運用する
2. Firebase Console に `v1 Rules` を設定する
3. 本番直前に `participation` をリセットする
4. 実施回を分ける必要が出たら `v2` の session 分離へ移行する
5. 不正書き込みを問題にする段階で App Check または Cloud Functions を導入する
