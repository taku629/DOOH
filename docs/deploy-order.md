# Deploy 順メモ

PR #55(Callable Function `submitSwipeComplete` 経由のスワイプ集計)を本番反映する際の順序メモ。順番を間違えると、参加ページが一時的にカウントできなくなる/旧クライアントが書き込み拒否される事故が起きる。

## 前提

- Firebase プロジェクト `dooh-ca9c2` が **Blaze(従量課金)プラン** になっていること。Spark プランでは Gen 2 Cloud Functions を deploy 不可。
- `functions/` で `npm install` 済み。
- `functions/.env` を用意(検証時は `ENFORCE_APP_CHECK=false` のままで可)。
- 既存の参加ページが「直接 DB に書く旧経路」で動作中なので、Rules を先に絞ると一瞬書き込み不能になる。必ず下記の順を守る。

## Deploy 順

1. **Functions を先に deploy**

   ```bash
   firebase deploy --only functions:submitSwipeComplete --project dooh-ca9c2
   ```

   先に Callable を生やしておくことで、新クライアントが配信されても呼び出し先がある状態にする。

2. **Hosting を deploy**(参加ページが Callable を呼ぶ新コードになる)

   ```bash
   firebase deploy --only hosting --project dooh-ca9c2
   ```

   `predeploy` で `npm run build:admin` が走る。

3. **Database Rules を最後に deploy**(クライアント直書き禁止に切り替え)

   ```bash
   firebase deploy --only database --project dooh-ca9c2
   ```

   この時点で旧経路は閉じられるが、すでに 1 と 2 が完了しているので新経路でカウントは継続する。

## 逆順にすると何が起きるか

- **Rules → Functions** の順だと、Rules が先に書き込みを禁止 → まだ Callable に切り替わっていない参加ページからの直書きが全部失敗 → 参加カウントが伸びない時間ができる。
- **Hosting → Functions** の順だと、新コードはデプロイ済みなのに呼び出し先 Function がまだ無く、参加が全部 `local fallback` に落ちて DB に同期されない。

## Roll back

- 直前の Hosting / Functions / Rules リリースに戻すなら Firebase Console の各サービスの「リリース履歴」から rollback。
- Rules だけ素早く戻したい場合は旧 `database.rules.json` を deploy し直すのが最速。

## 後追いタスク(本PRスコープ外)

- App Check を有効化したら `functions/.env` の `ENFORCE_APP_CHECK=true` に切り替えて再 deploy。
- 同一ユーザーの連打抑止(レート制限 / 匿名 Auth / IP ベース)は別 PR で検討。
- `swipes/` 件数と `participantCount` の整合監査ジョブは別途。
