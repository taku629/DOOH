#!/usr/bin/env python3
"""demo_v2.html が使う飛沫マスクと配置マップを生成する。

demo_v2 の DOOH は、荒廃した新宿 (assets/video/karasu.mp4) の上に、
回復後の新宿 (assets/video/clean-shinjuku.mp4) を飛沫の形で覗かせる。
そのマスクと、飛沫を落とす「的」の確率マップをここで作る。

出力 (assets/ink-people/):
  shape-NN-core.png : 飛沫のシルエット（透過PNG・切り詰め済み）
  plate.jpg         : 回復後の静止フレーム（着弾エフェクトの絵の出どころ）
  layout.json       : 形の寸法/重心 + 人の通行確率マップ + 傷の分布マップ

前提と注意:
  * karasu / clean は同じ画角の固定カメラ。動くのはカラスと人だけ。
  * 元素材 assets/ink/NN.jpg は「回復後プレート ∩ 飛沫」の合成物で、
    多くの飛沫は素材の段階で直線に切り落とされている（完全に有機的なのは
    05/06 のみ）。直線のまま使うと窓が角丸の矩形に見えるため、切断辺を
    検出して、その辺だけインクらしい揺らぎ＋小滴で作り直す。
    有機的な辺は本物のインクなのでそのまま残す。
  * マスクは輝度で起こすので、プレートが暗い画素（窓ガラス・庇の影）が穴になる。
    アルファ切り抜きでは穴から廃墟が透けるため solidify() で塞ぐ。

使い方: python3 scripts/make-ink-people-assets.py
"""
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/ink-people"
W, H = 1920, 1080
GX, GY = 48, 27          # 確率マップの格子
PLATE_SEC = 2.333        # ink 素材の合成に使われた clean のフレーム（実測で同定）
KARASU_SEC = 2.333

# 最後の反転のために予約する領域（窓を開けない）
RESERVED = [
    (110, 350, 980, 1570),   # JR新宿駅の看板
    (0, 260, 980, 1600),     # 駅上の電子広告板
]


def grab_frame(video: Path, seconds: float, dest: Path) -> Image.Image:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", str(seconds),
         "-i", str(video), "-frames:v", "1", str(dest)],
        check=True,
    )
    return Image.open(dest).convert("RGB").resize((W, H))


def silhouette(path: Path) -> np.ndarray:
    a = np.asarray(Image.open(path).convert("RGB"), dtype=np.int16)
    return (a.mean(2) > 14) | ((a.max(2) - a.min(2)) > 22)


def solidify(mask: np.ndarray) -> np.ndarray:
    """ゴマ塩を閉じ、飛沫の内部にできた穴を塞ぐ。"""
    im = Image.fromarray((mask * 255).astype(np.uint8), "L")
    im = im.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    a = np.asarray(im) > 128

    # マスク=255 / 外=0 で1px余白を付け、角(=0)から塗る。塗り残った0が内部の穴。
    h, w = a.shape
    pad = Image.new("L", (w + 2, h + 2), 0)
    pad.paste(Image.fromarray((a * 255).astype(np.uint8), "L"), (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    return a | (np.asarray(pad)[1:-1, 1:-1] == 0)


def cells(y0, y1, x0, x1):
    return (slice(int(GY * y0 / H), int(np.ceil(GY * y1 / H))),
            slice(int(GX * x0 / W), int(np.ceil(GX * x1 / W))))


# ---- 切断辺の修復 ----------------------------------------------------------
# 素材の切断は軸平行（矩形で切り出されている）なので、bbox の各辺に
# 長い直線として現れる。辺ごとに検出し、なめらかなノイズで内側に食い込ませ
# つつ外側に膨らませ、仕上げのボカシ→二値化で表面張力のような縁にする。
REPAIR_PAD = 90          # 外側への膨らみと小滴のための余白
WOBBLE_STEP = 64         # 揺らぎの制御点間隔(px)。大きいほどうねりが緩い
WOBBLE_IN, WOBBLE_OUT = 44, 26   # 内側に食う最大 / 外側に出る最大(px)


def smooth_noise(n, rng, step=WOBBLE_STEP, lo=-WOBBLE_IN, hi=WOBBLE_OUT):
    pts = rng.uniform(lo, hi, n // step + 2)
    idx = np.arange(n) / step
    i0 = idx.astype(int)
    t = (1 - np.cos((idx - i0) * np.pi)) / 2
    return pts[i0] * (1 - t) + pts[i0 + 1] * t


def cut_runs(edge, valid, near_tol=3, min_len=120):
    """辺に張り付いた境界の連続区間 [start, end) を列挙する。"""
    near = valid & (edge <= near_tol)
    runs, s = [], None
    for i, v in enumerate(np.append(near, False)):
        if v and s is None:
            s = i
        elif not v and s is not None:
            if i - s >= min_len:
                runs.append((s, i))
            s = None
    return runs


def repair_cut_edges(mask, rng):
    """直線に切れた辺をインクらしい縁に置き換える。mask は bbox 切り抜き済み。"""
    m = np.pad(mask, REPAIR_PAD)
    droplets = []
    for side in "LRTB":
        a = m if side in "LR" else m.T           # 行方向に辺が走るよう転置
        flip = side in "RB"                       # R/B は列を反転して L/T と同じ扱い
        v = a[:, ::-1] if flip else a
        valid = v.any(axis=1)
        first = np.argmax(v, axis=1)              # 各行で辺に最も近い画素
        inner = np.where(valid, first, 10 ** 9).min()   # bbox 辺の位置（=REPAIR_PAD）
        for s, e in cut_runs(first - inner, valid):
            off = smooth_noise(e - s, rng)
            ramp = np.minimum(1, np.minimum(np.arange(e - s), np.arange(e - s)[::-1]) / 40)
            off = (off * ramp).astype(int)
            for r, o in zip(range(s, e), off):
                ex = first[r]
                if o > 0:
                    v[r, max(0, ex - o):ex + 2] = True    # 外側へ膨らむ
                elif o < 0:
                    v[r, ex:ex - o] = False               # 内側へ食い込む
            # 切断辺の外に小滴を散らして、本物の辺の衛星滴と馴染ませる
            for _ in range(rng.integers(2, 5)):
                r = rng.integers(s, e)
                cy, cx = r, first[r] - rng.integers(20, 60)
                rad = int(rng.integers(5, 14))
                if cx - rad < 0:
                    continue
                droplets.append((side, cy, cx, rad, v.shape))
        # a / v は m のビューなので書き戻しは不要

    # 小滴は転置/反転を戻した座標系で描く
    im = Image.fromarray((m * 255).astype(np.uint8), "L")
    d = ImageDraw.Draw(im)
    for side, cy, cx, rad, shp in droplets:
        if side in "RB":
            cx = shp[1] - 1 - cx
        y, x = (cy, cx) if side in "LR" else (cx, cy)
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=255)

    im = im.filter(ImageFilter.GaussianBlur(4))
    return np.asarray(im) > 120


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        plate = grab_frame(ROOT / "assets/video/clean-shinjuku.mp4", PLATE_SEC, tmp / "clean.jpg")
        karasu = grab_frame(ROOT / "assets/video/karasu.mp4", KARASU_SEC, tmp / "karasu.jpg")
        plate.save(OUT / "plate.jpg", quality=90)

        # --- 飛沫のシルエット（-core を底に、切断辺だけ修復） ------------
        shapes = []
        for i in range(1, 10):
            stem = f"{i:02d}"
            core = solidify(silhouette(ROOT / f"assets/ink/{stem}-core.jpg"))
            ys, xs = np.nonzero(core)
            y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            mask = repair_cut_edges(core[y0:y1, x0:x1], np.random.default_rng(i))
            mask = solidify(mask)

            ys, xs = np.nonzero(mask)
            y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            alpha = (mask[y0:y1, x0:x1] * 255).astype(np.uint8)
            rgba = np.dstack([np.full_like(alpha, 255)] * 3 + [alpha])
            Image.fromarray(rgba, "RGBA").save(OUT / f"shape-{stem}-core.png", optimize=True)

            shapes.append({
                "w": int(x1 - x0), "h": int(y1 - y0),
                "cx": float(xs.mean() - x0), "cy": float(ys.mean() - y0),
            })

        # --- 人の通行確率マップ（clean 全体を平均） -------------------
        occ = np.zeros((GY, GX))
        frames = 60
        for n in range(frames):
            f = grab_frame(ROOT / "assets/video/clean-shinjuku.mp4", n * 10 / frames, tmp / f"f{n}.jpg")
            hsv = np.asarray(f.resize((GX * 8, GY * 8)).convert("HSV"), dtype=np.int16)
            m = ((hsv[..., 1] > 48) & (hsv[..., 2] > 55)).astype(float)
            occ += m.reshape(GY, 8, GX, 8).mean((1, 3))
        occ /= frames
        occ[: int(GY * 640 / H), :] = 0      # 上部の看板は人ではない

        # --- 傷マップ: 廃墟と回復の画素差（緑判定だと候補が11セルしか残らない）
        k8 = np.asarray(karasu.resize((GX * 8, GY * 8)), dtype=float)
        c8 = np.asarray(plate.resize((GX * 8, GY * 8)), dtype=float)
        diff = (np.abs(k8 - c8).mean(2) / 255.0).reshape(GY, 8, GX, 8).mean((1, 3))
        diff[int(GY * 560 / H):, :] = 0      # 下部は人の担当
        scar = np.clip((diff - 0.10) / 0.55, 0, 1) ** 1.5

        for y0, y1, x0, x1 in RESERVED:
            sy, sx = cells(y0, y1, x0, x1)
            scar[sy, sx] = 0
            occ[sy, sx] = 0
        cy, cx = cells(560, 1040, 640, 1120)  # カラスの通り道は狙いを弱める
        occ[cy, cx] *= 0.35

        (OUT / "layout.json").write_text(json.dumps({
            "frame": [W, H], "grid": [GX, GY], "shapes": shapes,
            "peopleMap": np.round(occ, 4).tolist(),
            "vineMap": np.round(scar, 4).tolist(),
        }, separators=(",", ":")))

    print(f"shape-*-core.png 9枚 / plate.jpg / layout.json → {OUT}")
    print(f"人マップ {int((occ > 0.01).sum())} セル / 傷マップ {int((scar > 0.01).sum())} セル")


if __name__ == "__main__":
    main()
