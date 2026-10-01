"""
qr_fast.py — 高速QRコード読み取り

高速化のポイント:
  1. ZBar(pyzbar)デコード … OpenCVのQRCodeDetectorより高速・高精度。
     pyzbar が無ければ OpenCV のデコーダに自動フォールバック。
  2. 縮小フレームで検出 … 幅 DETECT_WIDTH に縮小してから検出し、処理ピクセル数を削減。
  3. スレッド式キャプチャ … 別スレッドで常に最新フレームだけ保持。デコードがカメラをブロックしない。
  4. ROIトラッキング … 直近で見つかった位置の周辺だけを次フレームで探索。
     FULL_SCAN_INTERVAL フレームごと、または見失った時にフル探索へ戻す。
  5. バッファ1フレーム化 … CAP_PROP_BUFFERSIZE=1 で遅延フレームを捨て、常に最新を処理。

セットアップ:
  pip install opencv-python pyzbar
  # ZBar 本体（pyzbar が依存）:
  #   Linux: sudo apt install libzbar0
  #   macOS: brew install zbar
  # ※ pyzbar が無くても OpenCV だけで動作します（自動フォールバック）。

使い方:
  python qr_fast.py            # カメラ0を開いて読み取り。ESC または q で終了。
  python qr_fast.py --no-window  # ウィンドウ無し（WSL等でGUIが出ない環境向け、結果は標準出力へ）
"""

import argparse
import sys
import threading
import time
from collections import deque

import cv2
import numpy as np

# pyzbar は任意。無ければ OpenCV にフォールバック。
try:
    from pyzbar import pyzbar
    from pyzbar.pyzbar import ZBarSymbol
    _HAS_PYZBAR = True
except Exception:  # pragma: no cover - 環境依存
    _HAS_PYZBAR = False

# ---- チューニングパラメータ -------------------------------------------------
DETECT_WIDTH = 640          # 検出に使う縮小後の横幅(px)。小さいほど速いが遠距離に弱くなる。
FULL_SCAN_INTERVAL = 15     # 何フレームごとにフル探索へ戻すか。
ROI_PADDING = 60            # ROI探索時に前回bboxの周囲へ広げる余白(px, 縮小座標系)。
PRINT_COOLDOWN = 1.0        # 同じ内容を連続表示しない最小間隔(秒)。
# ---------------------------------------------------------------------------


class FrameGrabber:
    """別スレッドでカメラを回し、常に最新の1フレームだけを保持する。"""

    def __init__(self, src=0):
        self.cap = cv2.VideoCapture(src)
        if not self.cap.isOpened():
            raise RuntimeError(f"カメラを開けませんでした (src={src})")
        # 遅延の原因になる内部バッファを最小化（対応していないカメラでは無視される）。
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self._lock = threading.Lock()
        self._frame = None
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self):
        while self._running:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.005)
                continue
            with self._lock:
                self._frame = frame

    def read(self):
        with self._lock:
            if self._frame is None:
                return None
            return self._frame.copy()

    def release(self):
        self._running = False
        self._thread.join(timeout=1.0)
        self.cap.release()


# ---- デコーダ抽象化 ---------------------------------------------------------
# どちらも入力: グレースケール画像 / 出力: [(text, [(x,y)x4 polygon]), ...]

_cv_detector = cv2.QRCodeDetector()


def _decode_pyzbar(gray):
    results = []
    for sym in pyzbar.decode(gray, symbols=[ZBarSymbol.QRCODE]):
        text = sym.data.decode("utf-8", "replace")
        polygon = [(int(p.x), int(p.y)) for p in sym.polygon]
        results.append((text, polygon))
    return results


def _decode_opencv(gray):
    data, points, _ = _cv_detector.detectAndDecode(gray)
    if data and points is not None:
        polygon = [(int(x), int(y)) for x, y in points[0]]
        return [(data, polygon)]
    return []


decode = _decode_pyzbar if _HAS_PYZBAR else _decode_opencv


def main(camera=0, show_window=True):
    grabber = FrameGrabber(camera)
    print(f"[qr_fast] デコーダ: {'ZBar(pyzbar)' if _HAS_PYZBAR else 'OpenCV'} / "
          f"検出幅: {DETECT_WIDTH}px / ウィンドウ: {'あり' if show_window else 'なし'}")
    print("[qr_fast] 終了は ESC または q（ウィンドウ無し時は Ctrl+C）")

    last_bbox = None          # 縮小座標系での (x, y, w, h)。直近の検出位置。
    frames_since_full = 0
    fps_times = deque(maxlen=30)
    last_print = {}           # text -> 最後に表示した時刻

    try:
        while True:
            t0 = time.time()
            frame = grabber.read()
            if frame is None:
                time.sleep(0.005)
                continue

            h, w = frame.shape[:2]
            scale = DETECT_WIDTH / float(w)
            small = cv2.resize(frame, (DETECT_WIDTH, int(h * scale)),
                               interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

            # --- ROI: 直近の位置周辺だけ探索（速い）/ たまにフル探索（取りこぼし防止） ---
            use_roi = last_bbox is not None and frames_since_full < FULL_SCAN_INTERVAL
            if use_roi:
                bx, by, bw, bh = last_bbox
                x1 = max(0, bx - ROI_PADDING)
                y1 = max(0, by - ROI_PADDING)
                x2 = min(gray.shape[1], bx + bw + ROI_PADDING)
                y2 = min(gray.shape[0], by + bh + ROI_PADDING)
                roi = gray[y1:y2, x1:x2]
                offset = (x1, y1)
            else:
                roi = gray
                offset = (0, 0)
                frames_since_full = 0

            results = decode(roi)

            if results:
                frames_since_full += 1
                # bbox 更新（最初の検出を採用）。座標は roi -> small -> 元フレームへ。
                ox, oy = offset
                for text, polygon in results:
                    small_pts = [(px + ox, py + oy) for px, py in polygon]
                    xs = [p[0] for p in small_pts]
                    ys = [p[1] for p in small_pts]
                    last_bbox = (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))

                    now = time.time()
                    if now - last_print.get(text, 0) > PRINT_COOLDOWN:
                        print(f"[decoded] {text}")
                        last_print[text] = now

                    if show_window:
                        full_pts = np.array(
                            [(int(px / scale), int(py / scale)) for px, py in small_pts],
                            dtype=np.int32,
                        )
                        cv2.polylines(frame, [full_pts], True, (0, 255, 0), 2)
                        cv2.putText(frame, text, tuple(full_pts[0]),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            else:
                # 見失ったら次フレームはフル探索へ。
                last_bbox = None
                frames_since_full = FULL_SCAN_INTERVAL

            # --- FPS 表示 ---
            fps_times.append(time.time() - t0)
            if show_window:
                fps = len(fps_times) / max(sum(fps_times), 1e-6)
                cv2.putText(frame, f"{fps:5.1f} FPS  [{'ROI' if use_roi else 'FULL'}]",
                            (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 200, 255), 2)
                cv2.imshow("qr_fast", frame)
                if cv2.waitKey(1) & 0xFF in (27, ord("q")):
                    break
    except KeyboardInterrupt:
        pass
    finally:
        grabber.release()
        if show_window:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="高速QRコード読み取り")
    parser.add_argument("--camera", type=int, default=0, help="カメラのインデックス(既定:0)")
    parser.add_argument("--no-window", action="store_true",
                        help="GUIウィンドウを出さない（WSL等向け、結果は標準出力へ）")
    args = parser.parse_args()
    try:
        main(camera=args.camera, show_window=not args.no_window)
    except RuntimeError as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)
