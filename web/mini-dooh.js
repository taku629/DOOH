// mini-dooh.js — スマホ側「あなたの窓」ミニチュア同期（プロトタイプ）
//
// スワイプ完了後、感謝画面にDOOHのミニチュアを描き、本人のインクが
// 「実物と同じスロット・同じ形・同じ順序規則」で着弾する様子を再現する。
// 配置は決定的（layout.json + swipeCount だけで復元可能）なので、
// サーバー通信なしで本物のDOOHと同じ位置を計算できる。
//
// 決定性ロジックは demo_v2.html の buildPlacements / orderForChallenge /
// placementForSwipeCount と同一仕様（そちらが正）。定数を変える場合は両方を更新し、
// 検証（getSlotOrder との一致テスト）を再実行すること。
//
// フック: participant-flow-v6.js から window.__miniDooh?.onSwipeComplete?.(count)
//         / onNameThrown?.(name) が呼ばれる。本モジュールが無くてもフローは動く。

const TOTAL = 18;
const ASSET_BASE = new URL("../assets/ink-people/", import.meta.url);

let layout = null;
let container = null;
let revealWrap = null;
let beacon = null;
let caption = null;
let nameChip = null;
let currentPlacement = null;
let currentSwipeCount = 0;

const isEn = () => (document.documentElement.getAttribute("lang") || "ja").startsWith("en");
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TEXT = {
    caption: {
        ja: "新宿の大画面で、この窓がいま光っています",
        en: "This window is glowing on the big screen in Shinjuku right now",
    },
    captionNamed: {
        ja: "あなたの彩が名乗りました",
        en: "Your color now bears your name",
    },
    label: {
        ja: "あなたの窓",
        en: "Your window",
    },
};

// ===== demo_v2.html と同一の決定的マッピング =====
const mulberry32 = (seed) => () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const orderCache = new Map();
function orderForChallenge(ch) {
    const n = layout.slots.length;
    if (layout.slotsOrder !== "shuffle") return [...Array(n).keys()];
    if (orderCache.has(ch)) return orderCache.get(ch);
    const S = layout.slots;
    const dist = (a, b) => Math.hypot(S[a].ox - S[b].ox, S[a].oy - S[b].oy);
    let perm = null;
    for (let k = 0; k < 50 && !perm; k++) {
        const rand = mulberry32((ch * 101 + k) >>> 0);
        const cand = [...Array(n).keys()];
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [cand[i], cand[j]] = [cand[j], cand[i]];
        }
        if (cand.every((s, i) => i === 0 || dist(cand[i - 1], s) >= 20)) perm = cand;
    }
    if (!perm) perm = [...Array(n).keys()].map((_, i) => (i + ch) % n);
    orderCache.set(ch, perm);
    return perm;
}

function placementForSwipeCount(swipeCount) {
    if (!layout?.slots?.length) return null;
    const sc = Math.floor(Number(swipeCount));
    if (!Number.isFinite(sc) || sc <= 0) return null;
    const pos = ((sc - 1) % TOTAL + TOTAL) % TOTAL;
    const ch = Math.max(0, Math.floor((sc - 1) / TOTAL));
    const slot = layout.slots[orderForChallenge(ch)[pos]];
    const shape = layout.shapes[slot.shape];
    const [FW, FH] = layout.frame;
    const s = (slot.widthPct / 100 * FW) / shape.w;
    return {
        slot,
        shapeUrl: new URL(`shape-${String(slot.shape + 1).padStart(2, "0")}-core.png`, ASSET_BASE).href,
        // フレーム基準%（コンテナはフレームと同比率で描くので線形に使える）
        x: (slot.ox / 100 * FW - shape.cx * s) / FW * 100,
        y: (slot.oy / 100 * FH - shape.cy * s) / FH * 100,
        w: (shape.w * s) / FW * 100,
        h: (shape.h * s) / FH * 100,
        ox: slot.ox,
        oy: slot.oy,
        nameAnchor: slot.nameAnchor,
        pos,
        ch,
    };
}

// ===== 描画 =====
const CSS = `
.mini-dooh { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 12px;
  overflow: hidden; background: #14161a; margin: 14px 0 4px; box-shadow: 0 6px 22px rgba(0,0,0,.28); }
.mini-dooh-base { position: absolute; inset: 0; width: 100%; height: 100%;
  filter: grayscale(1) brightness(.5) contrast(1.05); }
.mini-dooh-reveal { position: absolute; -webkit-mask-size: 100% 100%; mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; opacity: 0; }
.mini-dooh-reveal img { position: absolute; display: block; }
.mini-dooh-beacon { position: absolute; width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.95); transform: translate(-50%,-50%);
  box-shadow: 0 0 10px rgba(255,255,255,.8); pointer-events: none; }
.mini-dooh-beacon.is-pulse { animation: miniDoohPulse 1.6s ease-out infinite; }
@keyframes miniDoohPulse {
  0% { box-shadow: 0 0 0 0 rgba(255,255,255,.55); }
  100% { box-shadow: 0 0 0 16px rgba(255,255,255,0); } }
.mini-dooh-tag { position: absolute; top: 8px; left: 10px; font-size: 11px; letter-spacing: .08em;
  color: rgba(255,255,255,.85); background: rgba(10,14,20,.55); padding: 2px 8px; border-radius: 999px; }
.mini-dooh-caption { font-size: 12.5px; line-height: 1.6; color: inherit; opacity: .85; margin: 2px 0 10px; }
.mini-dooh-name { position: absolute; transform: translate(-50%,-50%); font-size: 12px; font-weight: 700;
  color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,.7); background: rgba(10,14,20,.45);
  padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .mini-dooh-beacon.is-pulse { animation: none; } }
`;

function ensureStyle() {
    if (document.getElementById("mini-dooh-style")) return;
    const st = document.createElement("style");
    st.id = "mini-dooh-style";
    st.textContent = CSS;
    document.head.appendChild(st);
}

function ensureContainer() {
    if (container?.isConnected) return container;
    const anchor = document.getElementById("counterBox");
    if (!anchor?.parentNode) return null;
    ensureStyle();
    container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    const mini = document.createElement("div");
    mini.className = "mini-dooh";
    const base = document.createElement("img");
    base.className = "mini-dooh-base";
    base.src = new URL("plate.jpg", ASSET_BASE).href;
    base.alt = "";
    const tag = document.createElement("span");
    tag.className = "mini-dooh-tag";
    tag.textContent = TEXT.label[isEn() ? "en" : "ja"];
    mini.append(base, tag);
    caption = document.createElement("p");
    caption.className = "mini-dooh-caption";
    container.append(mini, caption);
    anchor.parentNode.insertBefore(container, anchor);
    container.miniEl = mini;
    return container;
}

function renderImpact(p) {
    const root = ensureContainer();
    if (!root) return;
    const mini = root.miniEl;
    revealWrap?.remove(); beacon?.remove(); nameChip?.remove(); nameChip = null;

    revealWrap = document.createElement("div");
    revealWrap.className = "mini-dooh-reveal";
    Object.assign(revealWrap.style, {
        left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`,
        webkitMaskImage: `url("${p.shapeUrl}")`, maskImage: `url("${p.shapeUrl}")`,
        transformOrigin: `${((p.ox - p.x) / p.w) * 100}% ${((p.oy - p.y) / p.h) * 100}%`,
    });
    // 中の色映像はコンテナ全体と同じ絵になるよう逆スケールで配置（=窓から覗く）
    const img = document.createElement("img");
    img.src = new URL("plate.jpg", ASSET_BASE).href;
    img.alt = "";
    Object.assign(img.style, {
        width: `${(100 / p.w) * 100}%`, height: `${(100 / p.h) * 100}%`,
        left: `${(-p.x / p.w) * 100}%`, top: `${(-p.y / p.h) * 100}%`,
    });
    revealWrap.appendChild(img);
    mini.appendChild(revealWrap);

    beacon = document.createElement("div");
    beacon.className = "mini-dooh-beacon is-pulse";
    beacon.style.left = `${p.ox}%`;
    beacon.style.top = `${p.oy}%`;
    mini.appendChild(beacon);

    caption.textContent = TEXT.caption[isEn() ? "en" : "ja"];

    // DOOHと同じ二拍（芯72%→完成100%）。reduced-motionは静かに定着
    const frames = reduceMotion()
        ? [ { opacity: 0, transform: "scale(0.97)" }, { opacity: 1, transform: "scale(1)" } ]
        : [
            { opacity: 0, transform: "scale(0.12) rotate(-8deg)", offset: 0 },
            { opacity: 1, transform: "scale(0.85) rotate(2deg)", offset: 0.26 },
            { opacity: 1, transform: "scale(0.72) rotate(-1deg)", offset: 0.44 },
            { opacity: 1, transform: "scale(0.72) rotate(-1deg)", offset: 0.58 },
            { opacity: 1, transform: "scale(1.08) rotate(1deg)", offset: 0.82 },
            { opacity: 1, transform: "scale(1) rotate(0deg)", offset: 1 },
          ];
    revealWrap.animate(frames, {
        duration: reduceMotion() ? 420 : 1060,
        easing: "cubic-bezier(0.18, 1.25, 0.32, 1)",
        fill: "forwards",
        delay: 350,
    });
}

function renderName(name) {
    if (!currentPlacement || !container?.isConnected) return;
    const p = currentPlacement;
    caption.textContent = TEXT.captionNamed[isEn() ? "en" : "ja"];
    if (revealWrap && !reduceMotion()) {
        revealWrap.animate(
            [
                { filter: "drop-shadow(0 0 0 rgba(255,255,255,0))" },
                { filter: "drop-shadow(0 0 14px rgba(255,255,255,.9))" },
                { filter: "drop-shadow(0 0 4px rgba(255,255,255,.35))" },
            ],
            { duration: 1600, fill: "forwards" }
        );
    }
    nameChip?.remove();
    nameChip = document.createElement("span");
    nameChip.className = "mini-dooh-name";
    const na = p.nameAnchor || { x: p.ox, y: Math.max(8, p.oy - 12) };
    nameChip.style.left = `${na.x}%`;
    nameChip.style.top = `${na.y}%`;
    nameChip.textContent = name;
    container.miniEl.appendChild(nameChip);
}

async function loadLayout() {
    if (layout) return layout;
    const res = await fetch(new URL("layout.json", ASSET_BASE), { cache: "no-cache" });
    layout = await res.json();
    return layout;
}

window.__miniDooh = {
    async onSwipeComplete(count) {
        try {
            await loadLayout();
            const p = placementForSwipeCount(count);
            if (!p) return;
            currentSwipeCount = Math.floor(Number(count));
            currentPlacement = p;
            renderImpact(p);
        } catch (e) {
            console.info("[mini-dooh] skipped:", e);
        }
    },
    onNameThrown(name) {
        try {
            const raw = String(name ?? "").trim();
            if (raw) renderName(raw);
        } catch (e) {
            console.info("[mini-dooh] name skipped:", e);
        }
    },
    // 検証用: demo_v2 の getSlotOrder / placements と一致することを確認する
    __debug: {
        order: async (ch) => { await loadLayout(); return orderForChallenge(Math.floor(ch)); },
        placement: async (sc) => { await loadLayout(); return placementForSwipeCount(sc); },
    },
};
