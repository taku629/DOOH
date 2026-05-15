# DOOH Display Player

新宿をテーマにした、参加型 DOOH（Digital Out Of Home）広告デモです。  
大型サイネージ側の表示プレイヤーと、QR コードからアクセスするスマートフォン向け参加フローを組み合わせ、ユーザーの参加操作をサイネージ演出に反映します。

## 概要

このプロジェクトは、待ち時間中の生活者がスマートフォンから「1 スワイプ」で参加し、その参加が DOOH 画面上の演出に反映される体験を想定しています。

- DOOH 表示画面: `index.html`
- スマートフォン参加画面: `web/participant-flow.html`
- 動画再生ロジック: `src/player.js`
- 時間帯別の動画選択: `src/scheduler.js`
- 参加イベント連携: `src/participation-bridge.js`
- プレイリスト設定: `config/playlist.json`

ブラウザだけで動作する静的なフロントエンド構成です。ビルドツールや npm パッケージは不要です。

## 主な機能

### 1. DOOH 表示プレイヤー

`index.html` は大型ディスプレイに表示する画面です。

主な要素は以下です。

- フルスクリーン動画プレイヤー
- 動画が読み込めない場合のビジュアルフォールバック
- QR 参加案内パネル
- スマートフォン参加数のライブ表示
- 参加イベント受信時の参加演出動画への切り替え

起動時に `config/playlist.json` を読み込み、現在時刻に合う動画を `src/scheduler.js` で選択します。

### 2. スマートフォン参加フロー

`web/participant-flow.html` は QR コードからアクセスする想定の参加ページです。

参加ステップは以下の 5 段階です。

1. はじめに
2. スワイプ操作
3. 参加完了
4. 参加証作成
5. シェア

スライダーを 100% まで動かして完了すると、参加数が加算され、DOOH 表示画面へ参加イベントが送られます。

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
  "fallback": "video/default.mp4",
  "participationVideo": "video/participation.mp4",
  "participationReturnSeconds": 8,
  "rules": [
    {
      "name": "male",
      "start": "00:00",
      "end": "10:59",
      "video": "video/male.mp4"
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
| `rules[].name` | ルール名。管理用のラベル |
| `rules[].start` | 再生開始時刻。`HH:MM` 形式 |
| `rules[].end` | 再生終了時刻。`HH:MM` 形式 |
| `rules[].video` | 対象時間帯に再生する動画パス |

`src/scheduler.js` は現在時刻を `HH:MM` に変換し、最初に一致した `rules` の `video` を返します。一致するルールが無い場合は `fallback` を返します。

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
│   ├── fallback-handler.js       # 動画フォールバック再生
│   ├── logger.js                 # ログ出力
│   ├── condition-manager.js      # 現在は未使用
│   └── fallback-manager.js       # 現在は未使用
├── web/
│   ├── participant-flow.html     # スマートフォン参加ページ
│   ├── participant-flow.css      # 参加ページのスタイル
│   └── participant-flow.js       # 参加ページのロジック
├── assets/
│   └── shinjuku-relight.svg      # キービジュアル
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
5. スライダーを 100% まで動かし、「完了して次へ」を押します。
6. DOOH 表示画面の参加数とステータスが更新されることを確認します。
7. `participationVideo` が設定され、動画ファイルが存在する場合は参加演出動画に切り替わります。
8. `participationReturnSeconds` 秒後に通常動画へ戻ります。

## 動画ファイルの配置

`config/playlist.json` では、現在以下の動画パスが指定されています。

- `video/default.mp4`
- `video/participation.mp4`
- `video/male.mp4`
- `video/female.mp4`

実際に動画を再生するには、設定されたパスに動画ファイルを配置してください。動画が無い場合、ブラウザの動画再生は失敗し、`index.html` 内のビジュアルフォールバックが表示されます。

リポジトリには `videos/` ディレクトリがあります。動画を `videos/` に置く場合は、`config/playlist.json` のパスも `videos/default.mp4` のように合わせて変更してください。

## カスタマイズ方法

### 表示する動画を変更する

`config/playlist.json` の `rules[].video` を変更します。

例:

```json
{
  "name": "morning",
  "start": "07:00",
  "end": "10:59",
  "video": "videos/morning.mp4"
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
- 参加数の加算
- 参加証プレビューの作成
- リンクコピー
- 参加イベントの送信

## Firebase 連携(クロス端末同期)

DOOH 画面とスマホ参加ページを **別端末で動かす**ためには Firebase Realtime Database を経由します。同一ブラウザ・同一オリジンでの同期は `participation-bridge.js` (localStorage + BroadcastChannel) でこれまで通り動きます。

### セットアップ手順

1. https://console.firebase.google.com/ で新規プロジェクトを作成
2. **Build → Realtime Database → データベースを作成** で「テストモードで開始」を選択(30日間は誰でも読み書き可能)
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

5. **プロジェクト設定 → 全般 → 承認済みドメイン** に、デプロイ先(`taku629.github.io`)とローカル開発用(`localhost`)を追加
6. main にコミット & push (GitHub Actions が `gh-pages` に同期しデプロイ)

### 動作

- DOOH 画面 (`index.html`) を開くと、参加ページの URL を埋め込んだ QR コードが自動生成されます
- スマホでQRを読み取ると参加ページ (`web/participant-flow.html`) が開きます
- 参加フローでスワイプを 100% まで進め、「完了して次へ」を押すと `swipes` パスへ `swipe-completed` イベントを書き込みます
- DOOH 画面は新しい `swipe-completed` イベントを Firebase の `onChildAdded` で受信し、「参加演出のテイクオーバー画面 + 参加動画」に切り替えます
- `config/playlist.json` の `participationReturnSeconds` 秒後に通常映像に戻ります
- 同じテイクオーバーが既に再生中ならイベントは無視されます (連続タップによる点滅防止)

### イベント例

```json
{
  "type": "swipe-completed",
  "createdAt": 1715662800123,
  "name": "匿名サポーター",
  "userAgent": "Mozilla/5.0 (iPhone; ...)"
}
```

### 注意

- `config/firebase-config.json` の値はクライアント側で公開されます。これは Firebase の設計通りで秘密ではありませんが、**Security Rules** (`Database → ルール`) で書き込みを必ず制限してください:

  ```json
  {
    "rules": {
      "swipes": {
        ".read": true,
        ".write": "newData.child('type').val() === 'swipe-completed'"
      }
    }
  }
  ```

- 設定値が未入力(`REPLACE_ME` のまま)の場合、Firebase 連携は自動で無効になり、localStorage/BroadcastChannel ベースの同一オリジン連携だけが動きます
- 参加完了イベントはスマホ側の `publishSwipeComplete()` から送信され、DOOH 画面側の `subscribeToSwipeCompletes()` で受信します

## 現在の制限事項

- `downloadBtn` の「画像を保存」はデモ表示のみで、実際の画像生成は未実装です。
- 参加数はブラウザ上のデモ値であり、サーバー永続化はありません。
- 参加完了(スワイプ100%)時の `+1` カウンター更新は、Firebase 経由でクロス端末同期します。ただし参加数自体は永続カウントとして集計していません。
- `playlist.json` はルート直下にもありますが、現在プレイヤーが読み込むのは `config/playlist.json` です。
- `src/condition-manager.js` と `src/fallback-manager.js` は現在空ファイルです。

## デプロイ

静的ファイルとして配信できます。GitHub Pages、Netlify、Vercel、任意の静的ホスティングで利用できます。

デプロイ時は以下に注意してください。

- `index.html` がルートで配信されること
- `config/playlist.json` が `./config/playlist.json` として取得できること
- `web/participant-flow.html` が `/web/participant-flow.html` で開けること
- `assets/` と動画ファイルの相対パスが崩れないこと
- DOOH 表示画面と参加フローを同じオリジンで配信すること

## ライセンス

現時点ではライセンスファイルは含まれていません。公開・配布する場合は、用途に合わせて `LICENSE` を追加してください。
