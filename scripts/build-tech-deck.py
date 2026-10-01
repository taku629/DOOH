# -*- coding: utf-8 -*-
"""彩宿 技術構成デッキ — 提供PDFのフォーマットに準拠"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from lxml import etree

BLACK = RGBColor(0x00, 0x00, 0x00)
RED = RGBColor(0xFF, 0x00, 0x00)
NAVY = RGBColor(0x1F, 0x38, 0x64)
GRAY_BG = RGBColor(0xE7, 0xE7, 0xE7)
GRAY_TX = RGBColor(0x59, 0x59, 0x59)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
JP = "游ゴシック"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]


def _ea(run, name):
    rPr = run._r.get_or_add_rPr()
    latin = rPr.find(qn("a:latin"))
    ea = etree.SubElement(rPr, qn("a:ea"))
    ea.set("typeface", name)
    if latin is not None:
        latin.addnext(ea)


def style(run, size=18, bold=False, color=BLACK, name=JP):
    f = run.font
    f.name = name
    f.size = Pt(size)
    f.bold = bold
    f.color.rgb = color
    _ea(run, name)


def textbox(sl, x, y, w, h, lines, size=18, bold=False, color=BLACK,
            align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=1.0):
    tb = sl.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    if isinstance(lines, str) or isinstance(lines, tuple):
        lines = [lines]
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        if isinstance(ln, tuple):
            txt, opts = ln
        else:
            txt, opts = ln, {}
        r = p.add_run()
        r.text = txt
        style(r, size=opts.get("size", size), bold=opts.get("bold", bold),
              color=opts.get("color", color))
    return tb


def box(sl, x, y, w, h, fill=None, line=NAVY, lw=1.75, shape=MSO_SHAPE.RECTANGLE,
        dash=False):
    sh = sl.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid()
        sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(lw)
        if dash:
            sh.line.dash_style = 4  # dash
    sh.shadow.inherit = False
    sh.text_frame.word_wrap = True
    return sh


def boxtext(sh, lines, size=16, bold=True, color=BLACK, spacing=1.0):
    tf = sh.text_frame
    tf.margin_left = tf.margin_right = Inches(0.08)
    tf.margin_top = tf.margin_bottom = Inches(0.04)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    if isinstance(lines, str) or isinstance(lines, tuple):
        lines = [lines]
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.CENTER
        p.line_spacing = spacing
        if isinstance(ln, tuple):
            txt, opts = ln
        else:
            txt, opts = ln, {}
        r = p.add_run()
        r.text = txt
        style(r, size=opts.get("size", size), bold=opts.get("bold", bold),
              color=opts.get("color", color))


def arrow(sl, x, y, w, h, color=BLACK, shape=MSO_SHAPE.RIGHT_ARROW):
    sh = sl.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid()
    sh.fill.fore_color.rgb = color
    sh.line.fill.background()
    sh.shadow.inherit = False
    return sh


def dline(sl, x1, y1, x2, y2, color=BLACK, dash=True, lw=1.5):
    from pptx.enum.shapes import MSO_CONNECTOR
    c = sl.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1),
                                Inches(x2), Inches(y2))
    c.line.color.rgb = color
    c.line.width = Pt(lw)
    if dash:
        c.line.dash_style = 4
    return c


PAGE = {"n": 1}


def slide(title=None, ref=None, page=True):
    sl = prs.slides.add_slide(BLANK)
    if title:
        bar = sl.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.42), Inches(0.40),
                                  Inches(0.075), Inches(0.62))
        bar.fill.solid()
        bar.fill.fore_color.rgb = BLACK
        bar.line.fill.background()
        bar.shadow.inherit = False
        textbox(sl, 0.60, 0.36, 10.5, 0.72, title, size=34, anchor=MSO_ANCHOR.MIDDLE)
    if ref:
        textbox(sl, 0.42, 6.90, 10.5, 0.45,
                [("参照：" if i == 0 else "　　　") + r for i, r in enumerate(
                    ref if isinstance(ref, list) else [ref])],
                size=9, color=GRAY_TX, spacing=1.1)
    if page:
        textbox(sl, 12.45, 6.92, 0.5, 0.35, str(PAGE["n"]), size=13,
                color=BLACK, align=PP_ALIGN.RIGHT)
        PAGE["n"] += 1
    return sl


# ============================= 表紙 =============================
sl = prs.slides.add_slide(BLANK)
textbox(sl, 0, 1.55, 13.333, 1.9, "彩 宿", size=88, bold=True,
        align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
ln = sl.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.06), Inches(3.62),
                         Inches(1.2), Inches(0.035))
ln.fill.solid(); ln.fill.fore_color.rgb = BLACK; ln.line.fill.background()
ln.shadow.inherit = False
textbox(sl, 0, 4.05, 13.333, 0.6,
        [[("技 術 構 成 と ", {}), ("実 証 デ ー タ", {"color": RED})]][0],
        size=22, align=PP_ALIGN.CENTER)
textbox(sl, 0, 6.05, 13.333, 0.4, "2026/07/21", size=15, align=PP_ALIGN.CENTER)

# ===================== 1. システム全体構成 =====================
sl = slide("システム全体構成")
textbox(sl, 0.42, 1.30, 12.5, 0.4, "自前サーバーを持たない 3 層構成", size=17, bold=True)

b1 = box(sl, 0.60, 2.00, 3.5, 1.45, fill=None, line=NAVY)
boxtext(b1, [("DOOH 表示画面", {"size": 17}), ("大型サイネージ", {"size": 12, "bold": False, "color": GRAY_TX}),
             ("Vanilla JS / ESM", {"size": 12, "bold": False, "color": GRAY_TX})])
b2 = box(sl, 9.20, 2.00, 3.5, 1.45, fill=None, line=NAVY)
boxtext(b2, [("スマホ参加画面", {"size": 17}), ("QRから遷移", {"size": 12, "bold": False, "color": GRAY_TX}),
             ("Vanilla JS / ESM", {"size": 12, "bold": False, "color": GRAY_TX})])

db = box(sl, 3.95, 4.10, 5.45, 1.35, fill=BLACK, line=None)
boxtext(db, [("Firebase Realtime Database", {"size": 19, "color": WHITE}),
             ("リアルタイム同期 ＋ Security Rules", {"size": 12, "color": WHITE, "bold": False})])

ad = box(sl, 10.35, 5.75, 2.35, 0.85, fill=None, line=NAVY)
boxtext(ad, [("管理画面 /admin", {"size": 13}), ("React + Vite", {"size": 11, "bold": False, "color": GRAY_TX})])

dline(sl, 2.35, 3.45, 5.0, 4.10, color=NAVY, dash=False)
dline(sl, 10.95, 3.45, 8.35, 4.10, color=NAVY, dash=False)
dline(sl, 9.40, 4.78, 10.35, 5.90, color=NAVY, dash=True)
textbox(sl, 0.60, 3.52, 1.62, 0.55, ["購読", "onValue / onChildAdded"], size=10.5,
        color=GRAY_TX, align=PP_ALIGN.RIGHT, spacing=1.15)
textbox(sl, 11.08, 3.52, 1.66, 0.55, ["書き込み", "increment + 多パス update"], size=10.5,
        color=GRAY_TX, align=PP_ALIGN.LEFT, spacing=1.15)

cap = box(sl, 0.60, 5.75, 5.2, 0.85, fill=None, line=BLACK, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
boxtext(cap, [("全体を Firebase Hosting から", {"size": 14}), ("同一オリジンで配信", {"size": 14})])

# ===================== 2. 技術スタック =====================
sl = slide("技術スタック")
cols = [
    ("インフラ", ["Firebase Hosting", "静的配信 / 自動HTTPS", "本番・調査用でサイト分離"]),
    ("データベース", ["Realtime Database", "WebSocket ベース購読", "Security Rules で制御"]),
    ("フロントエンド", ["Vanilla JS (ESM)", "ビルド工程なし", "管理画面のみ React 18"]),
    ("認証", ["Firebase Auth", "Email / Password", "管理画面のみ適用"]),
]
x = 0.60
for name, items in cols:
    hd = box(sl, x, 1.55, 2.92, 0.62, fill=BLACK, line=None)
    boxtext(hd, (name, {"size": 17, "color": WHITE}))
    bd = box(sl, x, 2.17, 2.92, 1.62, fill=None, line=NAVY)
    tf = bd.text_frame
    tf.margin_left = Inches(0.16); tf.margin_top = Inches(0.14)
    tf.vertical_anchor = MSO_ANCHOR.TOP
    for i, it in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.line_spacing = 1.35
        r = p.add_run(); r.text = ("・" + it)
        style(r, size=12, bold=(i == 0), color=BLACK if i == 0 else GRAY_TX)
    x += 3.06

textbox(sl, 0.60, 4.20, 12.2, 0.4, "主要ライブラリ", size=15, bold=True)
libs = ["Firebase SDK 10.7.1（動的 import）", "qrcode 1.5.3", "React 18 + Vite 7",
        "Material Symbols（セルフホスト）"]
x = 0.60
for l in libs:
    b = box(sl, x, 4.70, 2.92, 0.62, fill=GRAY_BG, line=None)
    boxtext(b, (l, {"size": 11.5, "bold": False}))
    x += 3.06

note = box(sl, 0.60, 5.90, 12.14, 0.72, fill=None, line=RED, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
boxtext(note, ("表示画面と参加画面はビルド不要 ＝ イベント当日に最短で修正できる", {"size": 15, "color": RED}))

# ===================== 3. 技術選定の理由 =====================
sl = slide("技術選定の理由")
textbox(sl, 0.42, 1.28, 12.5, 0.4, "「短期間で作り、当日落ちない」を最優先", size=17, bold=True)

l = box(sl, 0.60, 1.95, 5.85, 2.15, fill=None, line=NAVY)
boxtext(l, [("一般的な構成", {"size": 16, "color": GRAY_TX}),
            ("アプリサーバー ＋ DB ＋ API", {"size": 15}),
            ("障害点が多い / コールドスタート", {"size": 12, "bold": False, "color": GRAY_TX})])
arrow(sl, 6.70, 2.75, 0.95, 0.55, color=RED)
r_ = box(sl, 7.90, 1.95, 4.84, 2.15, fill=BLACK, line=None)
boxtext(r_, [("採用：サーバーレス", {"size": 16, "color": WHITE}),
             ("静的配信 ＋ マネージド DB", {"size": 15, "color": WHITE}),
             ("直接書き込み ＋ Rules で制約", {"size": 12, "bold": False, "color": WHITE})])

textbox(sl, 0.60, 4.35, 12.2, 0.4, "得られたもの / トレードオフ", size=15, bold=True)
pros = [("コールドスタートなし", "演出の遅延ゼロ"), ("障害点が少ない", "運用が単純"),
        ("無料プラン内で運用", "コスト抑制"), ("複雑なロジック不可", "Rules で表現する必要")]
x = 0.60
for i, (t, s) in enumerate(pros):
    c = RED if i == 3 else NAVY
    b = box(sl, x, 4.85, 2.92, 1.05, fill=None, line=c)
    boxtext(b, [(t, {"size": 13.5, "color": c}), (s, {"size": 11, "bold": False, "color": GRAY_TX})])
    x += 3.06
textbox(sl, 0.60, 6.15, 12.2, 0.5,
        "※ より強い不正対策が必要な段階では Cloud Functions への集約と App Check を想定（移行手順は文書化済み）",
        size=12, color=GRAY_TX)

# ===================== 4. リアルタイム同期 =====================
sl = slide("リアルタイム同期の仕組み")
steps = [("① スワイプ完了", "参加者のスマホ"), ("② DB へ書き込み", "increment(1) + update"),
         ("③ 購読通知", "onChildAdded"), ("④ 演出発火", "サイネージが反応")]
x = 0.60
for i, (t, s) in enumerate(steps):
    b = box(sl, x, 2.30, 2.62, 1.55, fill=BLACK if i in (1, 3) else None,
            line=None if i in (1, 3) else NAVY)
    col = WHITE if i in (1, 3) else BLACK
    boxtext(b, [(t, {"size": 15, "color": col}), (s, {"size": 11, "bold": False,
             "color": WHITE if i in (1, 3) else GRAY_TX})])
    if i < 3:
        arrow(sl, x + 2.70, 2.90, 0.52, 0.36, color=BLACK)
    x += 3.22

big = box(sl, 3.60, 4.55, 6.13, 1.45, fill=None, line=RED, lw=2.5,
          shape=MSO_SHAPE.ROUNDED_RECTANGLE)
boxtext(big, [("スワイプから演出まで", {"size": 15, "bold": False}),
              ("約 1 〜 2 秒", {"size": 34, "color": RED})])

# ===================== 5. 同時アクセスの整合性 =====================
sl = slide("同時アクセスの整合性")
textbox(sl, 0.42, 1.28, 12.5, 0.4, "300人が同時にスワイプしても取りこぼさない", size=17, bold=True)

b = box(sl, 0.60, 1.90, 5.85, 1.45, fill=None, line=NAVY)
boxtext(b, [("旧：親ノードの transaction", {"size": 15, "color": GRAY_TX}),
            ("カウント加算とイベント作成を一括コミット", {"size": 12, "bold": False, "color": GRAY_TX})])
cb = box(sl, 1.30, 3.50, 4.45, 0.6, fill=None, line=RED, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
boxtext(cb, ("完全同時アクセスで CAS 競合が多発", {"size": 13, "color": RED}))

arrow(sl, 6.70, 2.35, 0.95, 0.55, color=RED)

b2 = box(sl, 7.90, 1.90, 4.84, 1.45, fill=BLACK, line=None)
boxtext(b2, [("現：increment ＋ 多パス update", {"size": 15, "color": WHITE}),
             ("サーバー側でアトミックに加算", {"size": 12, "bold": False, "color": WHITE})])
cb2 = box(sl, 8.30, 3.50, 4.05, 0.6, fill=None, line=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
boxtext(cb2, ("競合が原理的に発生しない", {"size": 13, "color": NAVY}))

textbox(sl, 0.60, 4.55, 12.2, 0.4, "二重投稿の防止", size=15, bold=True)
g = box(sl, 0.60, 5.05, 12.14, 1.30, fill=GRAY_BG, line=None)
rule = box(sl, 1.00, 5.32, 4.6, 0.75, fill=BLACK, line=None)
boxtext(rule, ('".write": "!data.exists()"', {"size": 15, "color": WHITE}))
arrow(sl, 5.90, 5.53, 0.75, 0.34, color=BLACK)
textbox(sl, 6.95, 5.35, 5.5, 0.75,
        [("同一イベント ID への 2 回目の書き込みを", {"size": 13.5, "bold": False}),
         ("DB 側で原子的に拒否（クライアント依存なし）", {"size": 13.5})],
        size=13.5)

# ===================== 6. 負荷試験（本番） =====================
sl = slide("負荷試験①　本番環境 300 人同時",
           "artifacts/load-test/prod-research-rerun-20260715/REPORT.md")
textbox(sl, 0.42, 1.28, 12.5, 0.4, "2026/07/15 実施　本番と同一インフラ・データは調査用チャンネルに隔離",
        size=15, bold=True)

kpis = [("カウント増分", "+300", "正確に一致"), ("失敗", "0", "件"),
        ("重複イベント", "0", "件"), ("p95 レイテンシ", "1,835", "ms")]
x = 0.60
for i, (t, v, s) in enumerate(kpis):
    b = box(sl, x, 2.00, 2.92, 1.90, fill=BLACK, line=None)
    boxtext(b, [(t, {"size": 13, "bold": False, "color": WHITE}),
                (v, {"size": 40, "color": WHITE}),
                (s, {"size": 11, "bold": False, "color": WHITE})])
    x += 3.06

textbox(sl, 0.60, 4.25, 12.2, 0.4, "その他の確認項目", size=15, bold=True)
rows = [("839 → 1,139 人", "表示画面が最終値まで正しく追従"),
        ("コンソールエラー 0 件", "黒画面・再生停止なし（スクリーンショット確認済み）"),
        ("本番カウンタ 792 のまま不変", "調査用チャンネルが本番に影響しないことを実証")]
y = 4.75
for a, bt in rows:
    l_ = box(sl, 0.60, y, 3.7, 0.58, fill=None, line=NAVY)
    boxtext(l_, (a, {"size": 13}))
    textbox(sl, 4.50, y + 0.13, 8.3, 0.4, bt, size=13, color=GRAY_TX)
    y += 0.68

# ===================== 7. 負荷試験（エミュレータ） =====================
sl = slide("負荷試験②　エミュレータ 1,000 人",
           "artifacts/load-test/dooh-load-results-2026-07-08.md")
textbox(sl, 0.42, 1.28, 12.5, 0.4, "Firebase Emulator ＋ 本番と同一の書き込みロジックで検証", size=15, bold=True)

hdr = ["シナリオ", "成功 / 失敗", "重複", "欠損", "p50 / p95"]
data = [["1,000 人 同時", "1000 / 0", "0", "0", "7,821 / 7,967 ms"],
        ["1,000 人 30秒分散", "1000 / 0", "0", "0", "3.7 / 9.3 ms"],
        ["1,000 人 120秒分散", "1000 / 0", "0", "0", "4.0 / 18.6 ms"],
        ["300 人 同時", "300 / 0", "0", "0", "743 / 760 ms"],
        ["二重スワイプ拒否", "10 成功 / 10 拒否", "—", "—", "Rules で原子的に拒否"]]
widths = [3.5, 2.6, 1.4, 1.4, 3.24]
x = 0.60
for w, h in zip(widths, hdr):
    c = box(sl, x, 1.95, w, 0.55, fill=BLACK, line=None)
    boxtext(c, (h, {"size": 13, "color": WHITE}))
    x += w
y = 2.50
for ri, row in enumerate(data):
    x = 0.60
    for w, cell in zip(widths, row):
        c = box(sl, x, y, w, 0.55, fill=GRAY_BG if ri % 2 == 0 else None, line=NAVY, lw=0.75)
        boxtext(c, (cell, {"size": 12.5, "bold": ri == 4,
                           "color": RED if ri == 4 else BLACK}))
        x += w
    y += 0.55

pt = box(sl, 0.60, 5.65, 12.14, 0.95, fill=None, line=RED, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
boxtext(pt, [("完全同時（同一ミリ秒）でも取りこぼしゼロ。", {"size": 15}),
             ("実際の利用は時間的に分散するため、その条件では p95 20ms 未満", {"size": 15, "color": RED})])

# ===================== 8. 障害耐性 =====================
sl = slide("障害耐性")
textbox(sl, 0.42, 1.28, 12.5, 0.4, "3 段階で備え、黒画面にはならない設計", size=17, bold=True)

fb = [("① 書き込みリトライ", "指数バックオフで再送", "一時的な通信断"),
      ("② 同一オリジン同期", "localStorage / BroadcastChannel", "Firebase 不通"),
      ("③ ビジュアル代替", "静的フォールバック表示", "映像が読めない")]
x = 0.60
for i, (t, s, w) in enumerate(fb):
    cond = box(sl, x, 1.95, 3.92, 0.6, fill=None, line=RED, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    boxtext(cond, (w, {"size": 13, "color": RED}))
    dline(sl, x + 1.96, 2.55, x + 1.96, 2.95, color=RED, dash=True)
    b = box(sl, x, 2.95, 3.92, 1.55, fill=BLACK if i == 1 else None, line=None if i == 1 else NAVY)
    col = WHITE if i == 1 else BLACK
    boxtext(b, [(t, {"size": 16, "color": col}),
                (s, {"size": 12, "bold": False, "color": WHITE if i == 1 else GRAY_TX})])
    x += 4.11

textbox(sl, 0.60, 4.90, 12.2, 0.4, "チャンネル分離による本番保護", size=15, bold=True)
g = box(sl, 0.60, 5.40, 12.14, 1.15, fill=GRAY_BG, line=None)
chs = ["participation（本番）", "participationResearch（調査）", "participationYouTube（配信）"]
x = 1.00
for i, c in enumerate(chs):
    b = box(sl, x, 5.65, 3.5, 0.62, fill=BLACK if i == 0 else None,
            line=None if i == 0 else NAVY)
    boxtext(b, (c, {"size": 12.5, "color": WHITE if i == 0 else BLACK}))
    x += 3.75

# ===================== 9. セキュリティ =====================
sl = slide("セキュリティとプライバシー")
textbox(sl, 0.42, 1.28, 12.5, 0.4, "個人情報を保存しないことを設計目標に置く", size=17, bold=True)

items = [("保存しないもの", ["氏名・連絡先", "位置情報", "個人識別子"], RED),
         ("保存するもの", ["参加数・時刻", "表示名（任意 24 字）", "匿名の訪問者 ID"], NAVY),
         ("DB 側の制約", ["ルートは既定で拒否", "+1 ずつの加算のみ", "未定義項目は拒否"], NAVY),
         ("不適切表現", ["日英 NG ワード", "コメント 60 字上限", "外部 API 接続口あり"], NAVY)]
x = 0.60
for name, its, col in items:
    hd = box(sl, x, 1.95, 2.92, 0.58, fill=col, line=None)
    boxtext(hd, (name, {"size": 14.5, "color": WHITE}))
    bd = box(sl, x, 2.53, 2.92, 1.65, fill=None, line=col)
    tf = bd.text_frame
    tf.margin_left = Inches(0.18); tf.margin_top = Inches(0.16)
    tf.vertical_anchor = MSO_ANCHOR.TOP
    for i, it in enumerate(its):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.line_spacing = 1.4
        r = p.add_run(); r.text = "・" + it
        style(r, size=12, bold=False, color=BLACK)
    x += 3.06

textbox(sl, 0.60, 4.55, 12.2, 0.4, "補足", size=15, bold=True)
notes = [("支援者コードは SHA-256 ハッシュで照合", "平文を DB に送らない"),
         ("Firebase の apiKey 公開は設計通り", "秘密情報ではなく Rules で制御"),
         ("決済機能は未実装", "1 スワイプ＝100 円相当の疑似募金")]
y = 5.05
for a, bt in notes:
    l_ = box(sl, 0.60, y, 4.9, 0.52, fill=None, line=NAVY)
    boxtext(l_, (a, {"size": 12.5}))
    textbox(sl, 5.70, y + 0.11, 7.1, 0.4, bt, size=12.5, color=GRAY_TX)
    y += 0.6

# ===================== 10. 現時点の制限事項 =====================
sl = slide("現時点の制限事項")
textbox(sl, 0.42, 1.28, 12.5, 0.4, "できていないことを明確にする", size=17, bold=True)

lim = [("実決済", "未実装（疑似募金の演出のみ）"),
       ("Cloud Functions 経由の集計", "本番未適用。設計と移行手順のみ策定済み"),
       ("App Check", "未有効化。有効化手順は文書化済み"),
       ("レート制限（連打抑止）", "未実装。別課題として認識"),
       ("別端末からの重複参加", "許容（Non-Goal）"),
       ("属性推定（性別・年齢）", "不使用。時間帯ルールで出し分け")]
y = 1.95
for i, (a, bt) in enumerate(lim):
    l_ = box(sl, 0.60, y, 4.2, 0.62, fill=BLACK, line=None)
    boxtext(l_, (a, {"size": 13.5, "color": WHITE}))
    r_ = box(sl, 4.80, y, 7.94, 0.62, fill=None, line=NAVY)
    boxtext(r_, (bt, {"size": 13, "bold": False}))
    y += 0.72

pt = box(sl, 0.60, 6.30, 12.14, 0.62, fill=None, line=RED, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
boxtext(pt, ("制限を把握したうえで、移行先の設計まで用意している", {"size": 14.5, "color": RED}))

# ===================== 11. まとめ =====================
sl = slide("まとめ")
pts = [("サーバーレス構成", "静的配信 ＋ マネージド DB。障害点を減らし、演出の遅延をなくす"),
       ("整合性は DB 側で担保", "increment のアトミック性と Security Rules で、競合と二重投稿を原理的に排除"),
       ("実測で裏付け", "本番 300 人同時で欠損・重複ゼロ、p95 1.8 秒。エミュレータでは 1,000 人まで確認"),
       ("止まらない設計", "3 段階のフォールバックと、本番を汚さないチャンネル分離")]
y = 1.75
for i, (t, s) in enumerate(pts):
    n = box(sl, 0.60, y, 0.75, 1.05, fill=BLACK, line=None)
    boxtext(n, (str(i + 1), {"size": 26, "color": WHITE}))
    b = box(sl, 1.35, y, 11.39, 1.05, fill=None, line=NAVY)
    tf = b.text_frame
    tf.margin_left = Inches(0.3)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
    r = p.add_run(); r.text = t
    style(r, size=17, bold=True, color=BLACK)
    p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.LEFT
    r2 = p2.add_run(); r2.text = s
    style(r2, size=12.5, bold=False, color=GRAY_TX)
    y += 1.20

textbox(sl, 0.60, 6.60, 12.2, 0.4, "https://shinjuku-dooh-live.web.app/", size=13, color=GRAY_TX)

out = r"C:\Users\karis\AppData\Local\Temp\claude\--wsl-localhost-Ubuntu-home-takumu-DOOH\03bb7c53-a37b-4aa1-84e0-aeef68273bb2\scratchpad\saijuku-tech-deck.pptx"
prs.save(out)
print("saved", out, "slides:", len(prs.slides.__iter__.__self__._sldIdLst))
