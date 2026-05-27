# DOOH Display Player

新宿をテーマにした、参加型 DOOH（Digital Out Of Home）広告デモです。  
大型サイネージ側の表示プレイヤーと、QR コードからアクセスするスマートフォン向け参加フローを組み合わせ、ユーザーの参加操作をサイネージ演出に反映します。

## 概要

このプロジェクトは、待ち時間中の生活者がスマートフォンから「1 スワイプ」でデモ募金し、その参加が DOOH 画面上の演出に反映される体験を想定しています。現時点の募金は疑似募金で、実際の決済処理は発生しません。

- DOOH 表示画面: `index.html`
- スマートフォン参加画面: `web/participant-flow.html`
- 動画再生ロジック: `src/player.js`
- 時間帯別の動画選択: `src/scheduler.js`
- 参加イベント連携: `src/participation-bridge.js`
- 管理画面: `web/admin-src/index.html`
- プレイリスト設定: `config/playlist.json`

公開 URL は Firebase Hosting に統一しています。

- v1 DOOH 表示: `https://dooh-ca9c2.web.app/v1`
- v1 参加ページ: `https://dooh-ca9c2.web.app/participant-v1`
- v1 女性向け参加ページ: `https://dooh-ca9c2.web.app/participant-v1-women`
- v1 男性向け参加ページ: `https://dooh-ca9c2.web.app/participant-v1-men`
- v1 みんな向け参加ページ: `https://dooh-ca9c2.web.app/participant-v1-all`
- v2 DOOH 表示: `https://dooh-ca9c2.web.app/v2`
- v2 参加ページ: `https://dooh-ca9c2.web.app/participant-v2`
- v3 DOOH 表示: `https://dooh-ca9c2.web.app/v3` または `https://dooh-ca9c2.web.app/v1?theme=morning`
- v3 参加ページ: `https://dooh-ca9c2.web.app/participant-v3` または `https://dooh-ca9c2.web.app/participant-v1?theme=morning`
- 管理画面: `https://dooh-ca9c2.web.app/admin`

DOOH 表示画面と参加ページはブラウザだけで動作する静的なフロントエンド構成です。管理画面は React + Vite でビルドし、生成された `web/admin-dist/` を Firebase Hosting から配信します。

## 主な機能

### 1. DOOH 表示プレイヤー

`index.html` は大型ディスプレイに表示する画面です。

主な要素は以下です。

- フルスクリーン動画プレイヤー
- 動画が読み込めない場合のビジュアルフォールバック
- QR 参加案内パネル
- スマートフォン参加数のライブ表示
- 参加イベント受信時の参加演出動画への切り替え
- デモ募金総額が指定金額に達した時の通常動画切り替え
- 管理画面からの公開中プレイリスト更新

起動時に `config/playlist.json` を読み込み、現在時刻に合う動画を `src/scheduler.js` で選択します。
Firebase 上に管理画面から公開した設定がある場合は、DOOH 表示プレイヤーがその設定を購読し、静的JSONの内容を上書きして反映します。

### 2. スマートフォン参加フロー

`web/participant-flow.html` は QR コードからアクセスする想定の参加ページです。
v1 DOOH の QR は従来の `web/participant-flow.html` に遷移します。女性向けの参加UIは `web/participant-flow-women.html`、男性向けの参加UIは `web/participant-flow-men.html`、みんな向けの参加UIは `web/participant-flow-all.html` として別URLで公開します。

参加ステップは以下の 5 段階です。

1. はじめに
2. スワイプ操作
3. 参加完了
4. 参加証作成
5. シェア

スライダーを 100% まで動かして完了すると、1回あたり100円のデモ募金として参加数が加算され、DOOH 表示画面へ参加イベントが送られます。

シェア画面では通常の Web Share、Instagramストーリー用画像、LINE、X、リンクコピーを提供します。Instagramストーリーは 9:16 の PNG をブラウザ上で生成し、`navigator.share()` がファイル共有に対応する端末では共有シートへ渡し、非対応環境では PNG 保存にフォールバックします。

### 3. 参加イベント連携

参加ページと DOOH 表示画面は、同一オリジン上で以下のブラウザ API を使って連携します。

- `localStorage`
- `BroadcastChannel`
- `storage` イベント

参加ページで `publishParticipationEvent()` が呼ばれると、`dooh:participation-event` というキーにイベント情報が保存されます。DOOH 表示画面側では `subscribeToParticipationEvents()` がその変更を受け取り、参加者名と参加数を表示します。

イベント例:

```json
{
  "id": "random-event-id",
  "type": "participant-joined",
  "name": "匿名サポーター",
  "createdAt": "2026-05-13T00:00:00.000Z"
}
```

### 4. 時間帯別動画再生

`config/playlist.json` の `rules` に従って、現在時刻に合う通常動画を選択します。

```json
{
  "fallback": "videos/default.mp4",
  "participationVideo": "videos/participation.mp4",
  "participationReturnSeconds": 8,
  "donationMilestones": [
    {
      "name": "total-5000",
      "thresholdYen": 5000,
      "video": "videos/milestone-5000.mp4"
    }
  ],
  "rules": [
    {
      "name": "male-morning",
      "audience": "male",
      "start": "00:00",
      "end": "10:59",
      "video": "videos/male.mp4"
    },
    {
      "name": "female-day",
      "audience": "female",
      "start": "11:00",
      "end": "23:59",
      "video": "videos/female.mp4"
    }
  ]
}
```

設定項目:

| 項目 | 内容 |
| --- | --- |
| `fallback` | 通常動画が選ばれない場合、または再生に失敗した場合の代替動画 |
| `participationVideo` | スマートフォン参加を受け取ったときに一時再生する演出動画 |
| `participationReturnSeconds` | 参加演出動画から通常動画へ戻るまでの秒数 |
| `donationMilestones[].name` | 金額到達ルール名。管理用のラベル |
| `donationMilestones[].thresholdYen` | この金額以上になったら対象動画へ切り替えるしきい値 |
| `donationMilestones[].video` | 金額到達後に通常動画として再生する動画パス |
| `rules[].name` | ルール名。管理用のラベル |
| `rules[].audience` | 想定する素材区分。例: `male` / `female`。現在の再生条件には使わず、管理用ラベルとして扱います |
| `rules[].start` | 再生開始時刻。`HH:MM` 形式 |
| `rules[].end` | 再生終了時刻。`HH:MM` 形式 |
| `rules[].video` | 対象時間帯に再生する動画パス |

`src/scheduler.js` は現在時刻を `HH:MM` に変換し、最初に一致した `rules` の `video` を返します。一致するルールが無い場合は `fallback` を返します。男女別に素材を分ける場合も、現在の実装ではカメラや属性推定ではなく、時間帯ルールでどちらの素材を流すかを決めます。

`donationMilestones` は参加数から算出したデモ募金総額に対して評価されます。1参加あたり100円のため、`thresholdYen: 5000` は50人到達時に一致します。複数の金額ルールに一致する場合は、最も高い `thresholdYen` の動画を通常動画として使います。参加演出動画が再生中の場合はすぐに割り込まず、`participationReturnSeconds` 後に戻る通常動画が金額到達後の動画に変わります。

`rules` は上から順に評価されます。意図しない動画が選ばれないように、通常は時間帯が重複しないように設定してください。深夜帯のように日付をまたぐ場合は、`start` を `22:00`、`end` を `05:59` のように指定できます。

## ディレクトリ構成

```text
.
├── index.html                    # DOOH 表示プレイヤー
├── config/
│   └── playlist.json             # 動画再生ルール
├── src/
│   ├── player.js                 # 表示プレイヤー本体
│   ├── scheduler.js              # 時間帯別動画選択
│   ├── participation-bridge.js   # 参加イベント送受信
│   ├── admin-bridge.js           # 管理画面の認証/公開操作
│   ├── fallback-handler.js       # 動画フォールバック再生
│   ├── logger.js                 # ログ出力
│   ├── condition-manager.js      # 金額到達時の動画切り替え判定
│   └── fallback-manager.js       # 現在は未使用
├── web/
│   ├── admin-src/                # React 管理画面のソース
│   ├── admin-dist/               # React 管理画面のビルド結果
│   ├── participant-flow.html     # スマートフォン参加ページ
│   ├── participant-flow.css      # 参加ページのスタイル
│   └── participant-flow.js       # 参加ページのロジック
├── assets/
│   └── test.png      # キービジュアル
├── videos/                       # 動画配置用ディレクトリ
└── playlist.json                 # 現在は空ファイル
```

## 起動方法

このプロジェクトは ES Modules と `fetch()` を使うため、ファイルを直接開くのではなくローカルサーバーで起動してください。

```bash
python3 -m http.server 8000
```

起動後、以下の URL にアクセスします。

- DOOH 表示画面: `http://localhost:8000/`
- 参加フロー: `http://localhost:8000/web/participant-flow.html`

## 動作確認手順

1. ターミナルでローカルサーバーを起動します。
2. ブラウザで `http://localhost:8000/` を開きます。
3. 別タブ、または別ウィンドウで `http://localhost:8000/web/participant-flow.html` を開きます。
4. 参加フローで「参加する」を押します。
5. スライダーを 100% まで動かし、「¥100をデモ募金する」を押します。
6. DOOH 表示画面の参加数とステータスが更新されることを確認します。
7. `participationVideo` が設定され、動画ファイルが存在する場合は参加演出動画に切り替わります。
8. `participationReturnSeconds` 秒後に通常動画へ戻ります。
9. デモ募金総額が `donationMilestones[].thresholdYen` 以上になると、戻り先の通常動画が `donationMilestones[].video` に変わります。

管理画面の開発時は `npm install` 後に `npm run dev:admin` を実行します。本番では `npm run build:admin` で生成される `web/admin-dist/index.html` が `/admin` に rewrite されます。

## 動画ファイルの配置

`config/playlist.json` では、現在以下の動画パスが指定されています。

- `videos/default.mp4`
- `videos/participation.mp4`
- `videos/milestone-5000.mp4`
- `videos/male.mp4`
- `videos/female.mp4`

実際に動画を再生するには、設定されたパスに動画ファイルを配置してください。動画が無い場合、ブラウザの動画再生は失敗し、`index.html` 内のビジュアルフォールバックが表示されます。

## カスタマイズ方法

### 表示する動画を変更する

`config/playlist.json` の `rules[].video` を変更します。

例:

```json
{
  "name": "male-morning",
  "audience": "male",
  "start": "07:00",
  "end": "10:59",
  "video": "videos/male.mp4"
}
```

### 参加演出の表示時間を変更する

`participationReturnSeconds` を変更します。

```json
{
  "participationReturnSeconds": 12
}
```

この場合、参加演出動画へ切り替わってから 12 秒後に通常動画へ戻ります。

### デモ募金総額で動画を切り替える

`config/playlist.json` の `donationMilestones` を変更します。

```json
{
  "donationMilestones": [
    {
      "name": "total-5000",
      "thresholdYen": 5000,
      "video": "videos/milestone-5000.mp4"
    },
    {
      "name": "total-10000",
      "thresholdYen": 10000,
      "video": "videos/milestone-10000.mp4"
    }
  ]
}
```

この場合、50人到達で `videos/milestone-5000.mp4`、100人到達で `videos/milestone-10000.mp4` が通常動画になります。既存の参加演出動画への一時切り替えはそのまま動きます。

### 管理画面で公開中設定を変更する

`web/admin-src/index.html` は React + Vite で実装した管理画面です。v1/v2/v3ごとに以下を操作できます。

- 現在の参加数とデモ募金総額の確認
- `fallback`、`participationVideo`、`participationReturnSeconds` の編集
- `donationMilestones` と `rules` の編集
- Firebase 上の公開中プレイリスト更新
- 参加数のリセット

公開と参加数リセットは Firebase Auth のログインユーザーだけが実行できます。Firebase Console の **Build → Authentication** で Email/Password を有効化し、管理者ユーザーを作成してください。
React と Firebase SDK は `npm run build:admin` で管理画面バンドルに含めます。Firebase Hosting の `predeploy` でも `npm run build:admin` を実行するため、`firebase deploy --only hosting,database --project dooh-ca9c2` の前に手動ビルドする必要はありません。

### 参加ページの文言を変更する

`web/participant-flow.html` を編集します。  
ステップごとの見出し、説明文、ボタン文言は HTML 内に直接記述されています。

### 参加ページの見た目を変更する

参加ページのデザイントークン (色・タイポグラフィ・角丸・影・モーション) は `web/theme.css` に集約されています。コンポーネント側の CSS (`web/participant-flow.css`) はトークンを `var(--*)` 経由で参照するだけなので、**`theme.css` の `:root` を差し替えれば全体のテーマを切り替えられます**。

主なトークン:

| カテゴリ | 変数 |
| --- | --- |
| Surface / Ink | `--bg`, `--bg-soft`, `--surface`, `--ink`, `--ink-secondary`, `--ink-tertiary`, `--separator`, `--hairline` |
| Brand | `--accent`, `--accent-strong`, `--gold`, `--blue` |
| Shadow | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| Radius | `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` |
| Motion | `--ease-out`, `--ease-in-out` |
| Typography | `--font-sans`, `--font-mono` |

#### テーマを差し替える

1. `web/theme.css` を開く
2. `:root` ブロック内の値を新しいテーマの値に置き換える(変数名は変えない)
3. 保存して push → デプロイ後、参加ページ全体が新しいテーマで描画される

`theme.css` の末尾には **claude.ai 風のペーパーテーマ**のサンプル `:root` がコメントアウトで置いてあります。コメントアウトを切り替えれば 1 ファイル編集だけでテーマを差し替えられます。

複数テーマを併用したい場合は、テーマごとに `theme-apple.css` / `theme-claude.css` のようにファイルを分け、`participant-flow.html` の `<link>` でロード対象を切り替える運用も可能です。

### v3 朝・通勤新宿テーマ

v3 は `?theme=morning`、または `/v3` / `/participant-v3` で表示します。背景画像は既存の `assets/test.png` を流用し、CSS だけでライトグレー、ホワイト、ブルー、ネイビーの高コントラスト表示に切り替えます。

`?theme=auto` を指定した場合は、7:00〜10:59 の時間帯だけ `morning` テーマになります。既存の `/v1` と `/v2` は、明示的に `theme` を指定しない限り従来テーマのままです。

### DOOH 側の表示文言を変更する

`index.html` を編集します。  
QR 案内、フォールバック表示、ライブ参加数パネルの文言は HTML 内に直接記述されています。

## 実装メモ

### `src/player.js`

DOOH 表示プレイヤーの中心となるモジュールです。

- `config/playlist.json` を読み込む
- 現在時刻に応じた通常動画を決定する
- 動画再生エラー時にフォールバック表示へ切り替える
- 参加イベントを購読する
- 参加イベント受信時に参加演出動画へ切り替える
- 一定時間後に通常動画へ戻す

### `src/participation-bridge.js`

参加ページと DOOH 表示画面の連携を担当します。

- `publishParticipationEvent(payload)`  
  参加イベントを作成し、`localStorage` と `BroadcastChannel` に送信します。

- `subscribeToParticipationEvents(callback)`  
  `storage` イベントと `BroadcastChannel` を購読し、重複しない参加イベントだけを callback に渡します。

### `web/participant-flow.js`

スマートフォン参加フローの状態管理を担当します。

- 現在ステップの表示切り替え
- 進行バーの更新
- スワイプ完了判定
- デモ募金の加算(1スワイプ = 100円相当)
- 参加証プレビューの作成
- リンクコピー
- 参加イベントの送信

## Firebase 連携(クロス端末同期)

DOOH 画面とスマホ参加ページを **別端末で動かす**ためには Firebase Realtime Database を経由します。同一ブラウザ・同一オリジンでの同期は `participation-bridge.js` (localStorage + BroadcastChannel) でこれまで通り動きます。

DB のデータ構造、Security Rules、運用リセット手順、将来のセッション分離案は `docs/database-design.md` にまとめています。
Realtime Database Rules は `database.rules.json` に定義しています。
Firebase CLI で反映する場合は、Firebase にログインしたうえで `firebase deploy --only database` を実行します。

### セットアップ手順

1. https://console.firebase.google.com/ で新規プロジェクトを作成
2. **Build → Realtime Database → データベースを作成**
3. **プロジェクト設定 → 全般 → マイアプリ → Web** で「ウェブアプリの追加」
4. 表示される `firebaseConfig` の値を `config/firebase-config.json` に上書きで保存:

   ```json
   {
     "apiKey": "AIzaSy...",
     "authDomain": "your-project.firebaseapp.com",
     "databaseURL": "https://your-project-default-rtdb.firebaseio.com",
     "projectId": "your-project",
     "storageBucket": "your-project.appspot.com",
     "messagingSenderId": "...",
     "appId": "..."
   }
   ```

5. **Build → Authentication → Sign-in method** で Email/Password を有効化し、管理者ユーザーを作成
6. **プロジェクト設定 → 全般 → 承認済みドメイン** に、デプロイ先(`dooh-ca9c2.web.app`)とローカル開発用(`localhost`)を追加
7. Firebase CLI で `firebase deploy --only hosting,database --project dooh-ca9c2` を実行

### 参加数を0から開始する

Firebase Realtime Database の `participation/participantCount` が未作成なら、最初の参加で `1` になります。既にテスト値が入っている場合は、公開前に Firebase Console で次のどちらかを実行してください。

- `participation/participantCount` を `0` にする
- `participation` ノードを削除する

### 動作

- DOOH 画面 (`index.html`) を開くと、参加ページの URL を埋め込んだ QR コードが自動生成されます
- スマホでQRを読み取ると参加ページ (`web/participant-flow.html`) が開きます
- 参加フローでスワイプを 100% まで進め、「¥100をデモ募金する」を押すと `participation` 配下の transaction で `participantCount` の +1 と `swipes/{eventId}` のイベント作成をまとめて実行します
- 参加済みの端末では `localStorage` の `dooh:participant-flow:participated` を見て、同じブラウザからの再カウントを防ぎます
- DOOH 画面は新しい `swipe-completed` イベントを Firebase の `onChildAdded` で受信し、累計デモ募金額を表示して「参加演出のテイクオーバー画面 + 参加動画」に切り替えます
- 参加数は `participation/participantCount` に保存されるため、ページを閉じてもリロードしても維持されます
- `config/playlist.json` の `participationReturnSeconds` 秒後に通常映像に戻ります
- 同じテイクオーバーが既に再生中ならイベントは無視されます (連続タップによる点滅防止)

### イベント例

```json
{
  "type": "swipe-completed",
  "createdAt": 1715662800123,
  "count": 1,
  "name": "匿名サポーター",
  "donationAmountYen": 100,
  "userAgent": "Mozilla/5.0 (iPhone; ...)"
}
```

### 注意

- `config/firebase-config.json` の値はクライアント側で公開されます。これは Firebase の設計通りで秘密ではありませんが、**Security Rules** (`Database → ルール`) で書き込みを必ず制限してください:

  `database.rules.json` の内容を Firebase Console の Realtime Database Rules に反映してください。

- 設定値が未入力(`REPLACE_ME` のまま)の場合、Firebase 連携は自動で無効になり、localStorage/BroadcastChannel ベースの同一オリジン連携だけが動きます
- 参加完了イベントはスマホ側の `publishSwipeComplete()` から送信され、DOOH 画面側の `subscribeToSwipeCompletes()` で受信します
- 一人一回制限は簡易版です。同じ端末・同じブラウザでは再カウントされませんが、別端末、別ブラウザ、プライベートブラウズ、ブラウザデータ削除までは防げません

## 現在の制限事項

- `downloadBtn` の「画像を保存」はデモ表示のみで、実際の画像生成は未実装です。
- 参加完了(スワイプ100%)時の `+1` カウンター更新は、Firebase Realtime Database の `participation/participantCount` に永続化します。デモ募金総額は `participantCount * 100円` として表示します。
- 疑似募金はデモ用の演出で、クレジットカード・電子決済・領収書発行などの実決済機能は未実装です。
- 管理画面の公開/リセット操作には Firebase Auth のログインが必要です。Auth を有効化していない環境では閲覧のみ可能です。
- `playlist.json` はルート直下にもありますが、現在プレイヤーが読み込むのは `config/playlist.json` です。
- `src/condition-manager.js` は金額到達時の動画切り替え判定で使用します。`src/fallback-manager.js` は現在空ファイルです。

## デプロイ

本番公開は Firebase Hosting に統一しています。GitHub Pages への自動デプロイは使いません。

デプロイ時は以下に注意してください。

- `firebase deploy --only hosting --project dooh-ca9c2` で Firebase Hosting に反映すること。Hosting の `predeploy` で管理画面をビルドします
- `index.html` が `/v1` と `/v3`、`index-v2.html` が `/v2` の rewrite で配信されること
- `config/playlist.json` が `./config/playlist.json` として取得できること
- `web/participant-flow.html` が `/participant-v1` と `/participant-v3`、`web/participant-flow-v2.html` が `/participant-v2` の rewrite で開けること
- `web/admin-dist/index.html` が `/admin` の rewrite で開けること
- `assets/` と動画ファイルの相対パスが崩れないこと
- DOOH 表示画面と参加フローを同じオリジンで配信すること

## ライセンス

現時点ではライセンスファイルは含まれていません。公開・配布する場合は、用途に合わせて `LICENSE` を追加してください。
