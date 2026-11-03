from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation()

# Title Slide
slide = prs.slides.add_slide(prs.slide_layouts[0])
title = slide.shapes.title
subtitle = slide.placeholders[1]
title.text = "新宿DOOH - システムアーキテクチャ"
subtitle.text = "リアルタイム通信、重複防止トランザクション、表示同期の仕組み\n技術解説資料"

# Slide 1: System Overview
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]
title.text = "システム全体構成"
tf = body.text_frame
tf.text = "DOOHプロジェクトは主に以下の3層から構成されています："
p = tf.add_paragraph()
p.text = "1. スマホ参加フロー（フロントエンド）"
p.level = 1
p = tf.add_paragraph()
p.text = "Firebase Hostingから配信。ユーザーがQRコードを読み取り、Webブラウザ上でスワイプして参加。"
p.level = 2
p = tf.add_paragraph()
p.text = "2. バックエンド（Firebase Realtime Database）"
p.level = 1
p = tf.add_paragraph()
p.text = "システムの中枢として機能。トランザクション処理、状態の同期、セキュリティルールによるバリデーションを担当。"
p.level = 2
p = tf.add_paragraph()
p.text = "3. DOOHディスプレイ（demo.html 等）"
p.level = 1
p = tf.add_paragraph()
p.text = "Firebaseのイベントをリアルタイムに監視し、インク演出や映像の切り替えを大画面で描画するWebクライアント。"
p.level = 2

# Slide 2: Real-time Communication Flow
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]
title.text = "リアルタイム通信のフロー"
tf = body.text_frame
tf.text = "スマホのスワイプが数ミリ秒で大画面に反映されるまでの流れ："
p = tf.add_paragraph()
p.text = "1. スワイプ実行:"
p.level = 1
p = tf.add_paragraph()
p.text = "publishSwipeComplete() が呼び出され、Firebase SDK経由で書き込みをリクエスト。"
p.level = 2
p = tf.add_paragraph()
p.text = "2. トランザクション処理:"
p.level = 1
p = tf.add_paragraph()
p.text = "参加者データ（名前、ID等）を保存し、全体の参加者数（participantCount）を厳密に+1する。"
p.level = 2
p = tf.add_paragraph()
p.text = "3. Firebaseバリデーション:"
p.level = 1
p = tf.add_paragraph()
p.text = "database.rules.json が書き込みを監視し、「必ず現在の人数+1」であること等を強制。"
p.level = 2
p = tf.add_paragraph()
p.text = "4. リスナー発火と描画:"
p.level = 1
p = tf.add_paragraph()
p.text = "DOOH側の subscribeToParticipantCount() がイベントを検知し、インクを弾けさせる関数（splat）を実行。"
p.level = 2

# Slide 3: Duplicate Prevention & Transaction Logic
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]
title.text = "重複防止と排他制御（トランザクション）"
tf = body.text_frame
tf.text = "公平な参加を担保し、連打スパムを防ぐ仕組み："
p = tf.add_paragraph()
p.text = "1. 1日1回の参加制限:"
p.level = 1
p = tf.add_paragraph()
p.text = "localStorageに端末ごとのID（visitorId）を保存。サーバー側の dailyParticipants ノードで「同日・同ID」の書き込みを弾く。"
p.level = 2
p = tf.add_paragraph()
p.text = "2. トランザクション生成 (buildParticipationTransactionValue):"
p.level = 1
p = tf.add_paragraph()
p.text = "参加者数、スワイプ履歴、日別参加者、連続参加履歴の更新を1つのアトミックな操作としてまとめる。"
p.level = 2
p = tf.add_paragraph()
p.text = "3. セキュリティルールとリトライ制御:"
p.level = 1
p = tf.add_paragraph()
p.text = "同時の書き込みが衝突した場合、SDKが最大3回自動リトライを実施。それでも失敗した場合はユーザーにエラー（通信混雑）を返す。"
p.level = 2

# Slide 4: DOOH Visual Logic (18-Person Challenge)
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]
title.text = "DOOH演出ロジック（18人チャレンジ）"
tf = body.text_frame
tf.text = "インクが溜まっていくインタラクティブ演出のペース制御："
p = tf.add_paragraph()
p.text = "1. VISUAL_CHANGE_INTERVAL = 18:"
p.level = 1
p = tf.add_paragraph()
p.text = "18人の参加で1つの「チャレンジ（映像変化）」が完了する仕組み。"
p.level = 2
p = tf.add_paragraph()
p.text = "2. 2段階のインク着弾（Core & Final）:"
p.level = 1
p = tf.add_paragraph()
p.text = "9種類のインク × 2段階 = 計18ステップ。最初は小さく滲んだ「芯」が着弾し、次のスワイプで完全な「飛沫」に広がる。"
p.level = 2
p = tf.add_paragraph()
p.text = "3. 目標達成時の演出 (startCelebration):"
p.level = 1
p = tf.add_paragraph()
p.text = "18人目に達すると、全体を覆う最後のレイヤーが表示され、華やかな演出とともに次のチャレンジループへ移行する。"
p.level = 2

# Slide 5: Multi-Channel & Specialized Flows
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]
title.text = "マルチチャンネルと特殊フロー"
tf = body.text_frame
tf.text = "様々な環境や運用形態に合わせた柔軟なシステム設計："
p = tf.add_paragraph()
p.text = "1. チャンネル分割（Firebaseノード）:"
p.level = 1
p = tf.add_paragraph()
p.text = "participation, participationV2, participationMorning 等。DBを分けることで同時並行でのデモ実施を可能にする。"
p.level = 2
p = tf.add_paragraph()
p.text = "2. 体験UIのバリエーション:"
p.level = 1
p = tf.add_paragraph()
p.text = "通常版、スパークル版（women-orange）など、ターゲット層に合わせた専用のUI・文言を出し分ける。"
p.level = 2
p = tf.add_paragraph()
p.text = "3. YouTube Live モード:"
p.level = 1
p = tf.add_paragraph()
p.text = "1日1回制限を外し、10秒のクールダウンで何度でも参加できるようにした配信向けの特別モード。"
p.level = 2

prs.save('/home/takumu/projects/DOOH/dooh_technical_architecture_ja.pptx')
