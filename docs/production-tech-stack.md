# 本番技術スタック資料（プレゼン技術問答用）

対象: 新宿 参加型 DOOH プロトタイプ
作成日: 2026-07-20
参照リビジョン: `integration/name-supporter-production-20260715` (6054ed9)

---

## 1. 30秒サマリー（最初に聞かれたらこれ）

> 大型サイネージ側の表示画面とスマホ参加画面を、**Firebase Realtime Database のリアルタイム同期**でつないだ Web アプリです。
> サーバーサイドのアプリケーションコードは持たず、**静的ホスティング + マネージドDB** だけで構成しています。
> 参加者がスマホでスワイプすると 1〜2秒でサイネージ側の演出に反映されます。
> 本番環境で 300人同時アクセスの負荷試験を実施し、取りこぼし・二重カウントともに 0 件を確認済みです。

**技術選定の一言理由**: 展示・イベント用途で「短期間で作り、当日落ちない」ことが最優先。自前サーバーを持たないことで運用障害点を減らし、DBのリアルタイム同期機能をそのまま演出のトリガーに使っています。

---

## 2. 全体構成図

```
┌─────────────────────┐         ┌─────────────────────┐
│  DOOH 表示画面       │         │  スマホ参加画面      │
│  (大型サイネージ)     │         │  (QRから遷移)        │
│  demo_v2.html        │         │  participant-flow-* │
│  Vanilla JS / ESM    │         │  Vanilla JS / ESM   │
└──────────┬──────────┘         └──────────┬──────────┘
           │ onValue / onChildAdded         │ increment + multi-path update
           │ (購読)                          │ (書き込み)
           └───────────┬────────────────────┘
                       ▼
        ┌──────────────────────────────────┐
        │  Firebase Realtime Database       │
        │  participation / nameShouts /     │
        │  supporterComments / displayConfig│
        │  ※ Security Rules で書き込み制御   │
        └──────────────┬───────────────────┘
                       │
        ┌──────────────▼───────────────────┐
        │  管理画面 /admin                   │
        │  React 18 + Vite 7                │
        │  Firebase Auth (Email/Password)   │
        └──────────────────────────────────┘

        全体を Firebase Hosting から同一オリジンで配信
```

---

## 3. 技術スタック一覧

### インフラ / ホスティング

| 項目 | 採用技術 | 補足 |
|---|---|---|
| ホスティング | **Firebase Hosting** | プロジェクト `dooh-ca9c2` |
| 本番サイト | `shinjuku-dooh-live` | `firebase.json` |
| 調査用サイト | `shinjuku-dooh-rs` | `firebase-rs.json`（別サイトで隔離） |
| CDN | Firebase Hosting 標準CDN | 世界分散、自動HTTPS |
| 配信方式 | 静的配信（`public: "."`） | リポジトリ直下を配信、`ignore` で非公開物を除外 |

**キャッシュ戦略**: HTML はすべて `Cache-Control: no-cache, no-store, must-revalidate`。
→ *理由*: イベント当日に差し替えた内容が確実に反映されるため。動画・画像は CDN の標準キャッシュに任せています。

**主要ルーティング（rewrites）**

| URL | 実体 |
|---|---|
| `/` | `demo_v2.html`（DOOH 表示のメイン） |
| `/join`, `/men`, `/women` | `web/participant-flow-shared.html` |
| `/supporter/men`, `/supporter/women` | `web/participant-flow-supporter.html` |
| `/admin` | `web/admin-dist/index.html`（React ビルド成果物） |
| `/v1`, `/v2`, `/v3` | 旧バージョン表示画面（比較検証用に保持） |

### データベース

| 項目 | 採用技術 |
|---|---|
| DB | **Firebase Realtime Database** |
| 同期方式 | WebSocket ベースの購読（`onValue` / `onChildAdded`） |
| アクセス制御 | Security Rules（`database.rules.json`） |
| サーバーコード | **なし**（クライアント直接書き込み + Rules で制約） |

**チャンネル分離**: 用途ごとに独立したルートノードを持ち、本番データを汚さずに検証できます。

| チャンネル | ノード | 用途 |
|---|---|---|
| default | `participation` | 本番 |
| v2 | `participationV2` | v2 表示用 |
| morning | `participationMorning` | 朝テーマ用 |
| research | `participationResearch` | **負荷試験・調査用** |
| youtube | `participationYouTube` | 配信用 |

**その他ノード**: `nameShouts/{channel}`（名前演出）、`supporterComments/{channel}`（支援者コメント）、`displayConfig/{channel}`（管理画面からの配信設定）

### フロントエンド

| 領域 | 採用技術 | 理由 |
|---|---|---|
| 表示画面・参加画面 | **Vanilla JS (ES Modules)**、ビルドなし | 依存とビルド工程を持たず、当日の緊急修正を最短にするため |
| 管理画面 | **React 18.2 + Vite 7.2** | 状態を持つフォームUIのため。ここだけビルドあり |
| Firebase SDK（クライアント） | **v10.7.1**（gstatic から動的 import） | 参加画面のバンドル不要化。必要時のみ読み込み |
| Firebase SDK（管理画面・スクリプト） | **npm `firebase` ^12.6.0** | Vite バンドル / Node スクリプト用 |
| QRコード生成 | **qrcode 1.5.3**（skypack から動的 import） | 表示画面上で `QRCode.toCanvas()` により実行時生成 |
| アイコンフォント | Material Symbols（**セルフホスト** `.ttf`） | 外部フォントCDNへの依存を排除 |

**使用ブラウザAPI**（技術的な深掘り質問への備え）

| API | 用途 |
|---|---|
| `requestAnimationFrame` | 演出アニメーションの駆動（最多使用） |
| Canvas 2D (`getContext("2d")`) | 参加証・シェア画像の生成（1080×1920） |
| `MediaRecorder` | 参加証の動画書き出し（1080×1920） |
| `navigator.share` | ネイティブ共有シート連携（非対応環境は PNG 保存へフォールバック） |
| `localStorage` / `sessionStorage` | 参加済み判定、状態復元 |
| `BroadcastChannel` + `storage` イベント | Firebase 不通時の同一オリジン・フォールバック同期 |
| `crypto.subtle` | 支援者パスコードの SHA-256 ハッシュ化 |
| `crypto.randomUUID` | 訪問者ID・イベントID生成 |
| `matchMedia` | レスポンシブ / 省モーション設定への対応 |
| Web Animations API (`animate()`) | 宣言的アニメーション |
| `IntersectionObserver` | スクロール連動演出 |
| `navigator.vibrate` | スワイプ完了時の触覚フィードバック |

**CSS 表現技術**: `backdrop-filter`（18箇所）、`mix-blend-mode`、`mask-image` / `-webkit-mask`、`clip-path`、`will-change`
→ 映像レイヤーの合成表現を **GPU 合成される CSS プロパティのみ**で実装し、サイネージ側の描画負荷を抑えています。

### 映像

| 項目 | 内容 |
|---|---|
| コーデック | **H.264 / MP4** |
| 構成 | **4レイヤーの動画合成** |
| レイヤー | base（`karasu.mp4` 5.6MB）/ reveal + CSSマスク（`clean-shinjuku.mp4` 5.2MB）/ ink・warm レイヤー / idle（`yellow-idle.mp4` 1.3MB） |
| モバイル最適化 | `clean-shinjuku-mobile.mp4` 1.6MB、`karasu-mobile.mp4` 175KB を別途用意 |
| ビットレート調整 | `karasu.mp4` を **3.7Mbps に再圧縮**（ストリーミング再生の停止対策、コミット 7ab521e） |

### 認証

- **Firebase Authentication（Email/Password）**
- 適用範囲は**管理画面のみ**（配信設定の公開、参加数リセット）
- 参加者側は**認証なし**（体験のハードルを上げないため。QRを読んですぐ参加できる）

### CI / CD

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `firebase-deploy.yml` | `main` への push | Node 20 で `npm ci` → ビルド → Firebase Hosting へデプロイ |
| `firebase-preview.yml` | Pull Request | プレビューチャンネルへデプロイ |
| `deploy.yml` | （**現在は不使用**） | GitHub Pages 用。本番は Firebase Hosting に統一済み |

`firebase.json` の `predeploy` で `npm run build:admin` が自動実行されるため、管理画面の手動ビルドは不要です。

---

## 4. 中核となる技術判断（ここが一番聞かれます）

### 4-1. 同時アクセス時のカウント整合性

**課題**: 300人が同時にスワイプしたとき、参加数の取りこぼしや二重カウントが起きないか。

**当初の実装**: 親ノードの `runTransaction()` で「カウント加算 + イベント作成」を一括コミット。
**問題**: 完全同時アクセス時に CAS（比較して置換）の競合が多発し、リトライが積み上がる。

**現在の実装（2026-07-08 に移行）**:
```
1. participantHistory / dailyParticipants を read
2. increment(1) と swipe 本体を「多パス update」で一括送信
```
→ **競合が原理的に発生しない**設計。サーバー側の `increment` はアトミックに処理されるため、クライアント間の読み書き競合が起きません。

**二重投稿の防止**: Security Rules の `".write": "!data.exists()"` により、同一 `eventId` への2回目の書き込みを **DB 側で原子的に拒否**します。クライアント側のガードに依存しません。

### 4-2. 障害時のフォールバック

Firebase 設定が無効・不通の場合、`localStorage` + `BroadcastChannel` による**同一オリジン内の同期に自動的に切り替わります**。
→ ネットワーク障害時でも、同一端末・同一ブラウザ内でのデモは継続可能です。

### 4-3. サーバーレス構成の選択

Cloud Functions を経由せず、**クライアントから直接 DB に書き込み、Security Rules で制約する**方式を採用しています。

| メリット | トレードオフ |
|---|---|
| コールドスタートなし（演出の遅延ゼロ） | 認可ロジックを Rules で表現する必要がある |
| 障害点が少ない | 複雑な業務ロジックは書けない |
| Blaze プラン不要（コスト） | レート制限は別途必要 |

Rules 側で以下を検証しています:
- `participantCount` は **+1 ずつの増加のみ**許可
- `type` フィールドの値が `swipe-completed` であること
- コメントは **60文字以内**、名前は **24文字以内**
- 支援者コードは **64文字の16進ハッシュ**であること
- 未定義のフィールド追加を `"$other": { ".validate": false }` で拒否

---

## 5. 検証・品質保証（数値で答えられる項目）

### 5-1. 本番環境での 300人同時スワイプ試験

**実施日**: 2026-07-15 / **判定: PASS** / チャンネル: research（本番と同一インフラ、データは隔離）

| 指標 | 結果 |
|---|---|
| 送信 | 300件 |
| 成功 / 失敗 | **300 / 0** |
| カウント増分 | **正確に +300**（839 → 1139） |
| 重複イベント | **0件**（unique 300 / duplicate 0） |
| レイテンシ | **p50 1,201ms / p95 1,835ms / max 1,851ms** |
| 全体所要 | 1,853ms |
| コンソールエラー | **0件** |
| 表示画面の追従 | 最終的に 1,139人を正しく表示、演出の残留なし |
| 本番チャンネルへの影響 | `participation/participantCount` は **792 のまま不変** |

### 5-2. エミュレータ負荷試験（2026-07-08）

| シナリオ | 成功/失敗 | 重複 | 欠損 | 確定レイテンシ (p50/p95) |
|---|---|---|---|---|
| 1000人同時 | 1000 / 0 | 0 | 0 | 7,821ms / 7,967ms |
| 1000人・30秒分散 | 1000 / 0 | 0 | 0 | 3.7ms / 9.3ms |
| 1000人・120秒分散 | 1000 / 0 | 0 | 0 | 4.0ms / 18.6ms |
| 300人同時 | 300 / 0 | 0 | 0 | 743ms / 760ms |
| 二重スワイプ拒否 | 10成功 / 10拒否 | — | — | Rules で原子的に拒否 |

**読み取り方**:
- 完全同時（同一ミリ秒）でも**取りこぼしゼロ**。レイテンシは伸びるが確実に処理されます。
- 実際の利用（数十秒に分散）では **p95 で 20ms 未満**。
- チャンネル分離も検証済み（`channel-isolation`: default と youtube が互いに干渉しない）。

### 5-3. 映像再生スモークテスト

`scripts/dooh-video-smoke.mjs` — **headless Chromium + Chrome DevTools Protocol** で実動画3本の再生状態を監視。
60秒アイドル耐久、`canPlayType()` による MP4 再生可否の記録、黒画面・停止の検出を自動化しています。

**試験ツール**: すべて本番クライアントと**同一の書き込みロジック**（`src/firebase-bridge.js` の `publishSwipeComplete`）を再現。試験だけ通って本番で落ちる状態を避けています。

---

## 6. セキュリティ / プライバシー

| 項目 | 対応 |
|---|---|
| 個人情報 | **保存しない**（設計上の Goal として明記） |
| 保存データ | 参加数、イベント時刻、表示名（任意・24文字以内）、userAgent（デバッグ用） |
| 訪問者ID | `crypto.randomUUID()` による**匿名ID**。個人識別子は使用しない |
| 支援者パスコード | **SHA-256 ハッシュ**で照合（平文を DB に送らない） |
| 不適切表現対策 | `src/name-filter.js` による日英NGワードフィルタ（暴力・性的・差別表現） |
| 外部モデレーションAPI | 接続口を実装済み・**現在は無効**（`enabled: false`）。タイムアウト 1800ms で本体をブロックしない設計 |
| DB 既定権限 | ルートは `".read": false, ".write": false`。必要ノードのみ明示的に開放 |
| Firebase 設定の公開 | **設計通り**。`apiKey` は秘密情報ではなく、制御は Security Rules で実施 |
| 決済 | **実装なし**。1スワイプ = 100円相当の**疑似募金**（演出のみ） |

---

## 7. 想定 Q&A

**Q. なぜ React ではなく Vanilla JS なのですか？**
A. 表示画面と参加画面はビルド工程を持たないことを優先しました。イベント当日に文言や演出を直せる必要があり、ビルド・デプロイの往復を挟みたくなかったためです。一方、状態を持つフォームUIである管理画面は React + Vite を採用しており、**適材適所で分けています**。

**Q. なぜ Firestore ではなく Realtime Database なのですか？**
A. 用途が「1つのカウンタと追記専用のイベント列を、低遅延で多数のクライアントに配信する」ことに集中しているためです。RTDB は WebSocket ベースで接続あたりの遅延が小さく、`increment` によるアトミックな加算がそのまま使えます。Firestore の高度なクエリ機能は本件では不要でした。

**Q. サーバーがないと不正な書き込みを防げないのでは？**
A. Security Rules を「サーバー側の検証層」として使っています。カウントは +1 ずつしか増やせない、同一IDへの再書き込みは拒否、未定義フィールドは追加不可、といった制約を DB 側で強制しています。ただし**より強い対策が必要な段階では Cloud Functions への集約と App Check の有効化を想定しており、移行手順も文書化済み**です（`docs/deploy-order.md`）。

**Q. 何人まで耐えられますか？**
A. エミュレータ試験では1,000人の完全同時アクセスまで取りこぼしゼロを確認しています。本番環境では300人同時で p95 1.8秒・欠損ゼロの実測値があります。実際の利用は時間的に分散するため、その条件では p95 20ms 未満です。

**Q. 当日ネットワークが不安定になったら？**
A. 3段階で備えています。(1) 書き込みは指数バックオフでリトライ、(2) Firebase 不通時は localStorage / BroadcastChannel の同一オリジン同期へ自動フォールバック、(3) 映像が読めない場合は静的なビジュアルフォールバックを表示します。**黒画面にはならない設計**です。

**Q. 参加の重複はどう防いでいますか？**
A. DB レベルでは同一イベントIDの二重書き込みを Rules で原子的に拒否します。同一端末からの再参加は `localStorage` のフラグで抑止します。ただし**別端末・別ブラウザ・プライベートブラウズまでは防げず、これは現時点で許容している制限**です。厳密な本人確認は本プロトタイプの Non-Goal としています。

**Q. コストはどのくらいですか？**
A. Cloud Functions を使わない構成のため、Firebase の **Spark（無料）プランの範囲**で運用できています。主なコストは Hosting の転送量（動画アセット）で、モバイル向けに軽量版を用意して抑えています。

**Q. 検証環境と本番はどう分けていますか？**
A. 2段階です。(1) DB は `participationResearch` など**チャンネル単位でノードを分離**し、本番データを触らずに本番インフラで試験できます（実際に300人試験の際、本番カウンタが 792 のまま不変であることを確認済み）。(2) 調査用サイトは `shinjuku-dooh-rs` という**別 Hosting サイト**に分けています。

---

## 8. 現時点の制限事項（正直に答えるべき点）

技術問答では、**できていないことを明確に言えるかどうか**が信頼につながります。

| 項目 | 状態 |
|---|---|
| 実決済 | **未実装**。疑似募金の演出のみ |
| Cloud Functions 経由の集計 | **本番未適用**。設計と移行手順のみ策定済み（`functions/` ディレクトリは未作成、Rules は現在クライアント直書きを許可） |
| App Check | **未有効化**。有効化の手順は文書化済み |
| レート制限（連打抑止） | **未実装**。別課題として認識 |
| 別端末からの重複参加 | **許容**（Non-Goal） |
| 属性推定（性別・年齢） | **不使用**。カメラや推定は行わず、時間帯ルールで出し分け |
| ライセンス | LICENSE ファイル未整備 |

---

## 9. 参照ファイル

| 内容 | パス |
|---|---|
| 全体仕様・セットアップ | `README.md` |
| DB 設計・整合性モデル | `docs/database-design.md` |
| Security Rules 実体 | `database.rules.json` |
| Firebase 連携の中核 | `src/firebase-bridge.js` |
| 書き込みロジック | `src/participation-transaction.mjs` |
| Hosting 設定 | `firebase.json` / `firebase-rs.json` |
| 負荷試験の手順 | `scripts/README-load-test.md` |
| 負荷試験の結果 | `artifacts/load-test/` |
| Functions 移行手順 | `docs/deploy-order.md` |
