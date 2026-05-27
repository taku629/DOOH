const PROGRESS_THROTTLE_MS = 80;
const SHAKE_CLASSES = ["is-haptic-shake-soft", "is-haptic-shake-mid", "is-haptic-shake-strong"];

let lastProgressAt = 0;
let lastProgressValue = -1;
let shakeTimer = null;
let stylesInjected = false;

function injectShakeStyles() {
    if (stylesInjected || typeof document === "undefined") {
        return;
    }
    stylesInjected = true;
    const style = document.createElement("style");
    style.setAttribute("data-haptic", "true");
    style.textContent = `
@keyframes haptic-shake-soft {
  0%,100% { transform: translate3d(0,0,0); }
  50% { transform: translate3d(0,1px,0); }
}
@keyframes haptic-shake-mid {
  0%,100% { transform: translate3d(0,0,0); }
  25% { transform: translate3d(-1px,1px,0); }
  75% { transform: translate3d(1px,-1px,0); }
}
@keyframes haptic-shake-strong {
  0%,100% { transform: translate3d(0,0,0); }
  10% { transform: translate3d(-2px,2px,0); }
  30% { transform: translate3d(2px,-2px,0); }
  50% { transform: translate3d(-3px,1px,0); }
  70% { transform: translate3d(2px,2px,0); }
  90% { transform: translate3d(-1px,-2px,0); }
}
.is-haptic-shake-soft { animation: haptic-shake-soft 90ms ease-in-out 1; }
.is-haptic-shake-mid { animation: haptic-shake-mid 140ms ease-in-out 1; }
.is-haptic-shake-strong { animation: haptic-shake-strong 280ms ease-in-out 1; }
@media (prefers-reduced-motion: reduce) {
  .is-haptic-shake-soft, .is-haptic-shake-mid, .is-haptic-shake-strong { animation: none; }
}
`;
    document.head.appendChild(style);
}

function canVibrate() {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function prefersReducedMotion() {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyShake(intensityClass) {
    if (typeof document === "undefined" || !document.body) {
        return;
    }
    if (prefersReducedMotion()) {
        return;
    }
    injectShakeStyles();
    for (const cls of SHAKE_CLASSES) {
        document.body.classList.remove(cls);
    }
    void document.body.offsetWidth;
    document.body.classList.add(intensityClass);
    if (shakeTimer) {
        window.clearTimeout(shakeTimer);
    }
    shakeTimer = window.setTimeout(() => {
        document.body.classList.remove(intensityClass);
        shakeTimer = null;
    }, 320);
}

function pickShakeClass(progress) {
    if (progress >= 72) return "is-haptic-shake-strong";
    if (progress >= 40) return "is-haptic-shake-mid";
    return "is-haptic-shake-soft";
}

export function triggerProgressHaptic(progress) {
    const normalized = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
    if (normalized <= 0) {
        lastProgressValue = -1;
        return;
    }
    const now = (typeof performance !== "undefined" && typeof performance.now === "function")
        ? performance.now()
        : Date.now();
    if (now - lastProgressAt < PROGRESS_THROTTLE_MS) {
        return;
    }
    if (normalized === lastProgressValue) {
        return;
    }
    lastProgressAt = now;
    lastProgressValue = normalized;

    if (canVibrate()) {
        const duration = Math.max(4, Math.round(4 + (normalized / 100) * 24));
        try {
            navigator.vibrate(duration);
            return;
        } catch (_) {
            // fall through to shake fallback
        }
    }
    applyShake(pickShakeClass(normalized));
}

export function triggerCompletionHaptic() {
    if (canVibrate()) {
        try {
            navigator.vibrate([60, 40, 120]);
        } catch (_) {
            // ignore
        }
    }
    applyShake("is-haptic-shake-strong");
}

export function resetHapticState() {
    lastProgressAt = 0;
    lastProgressValue = -1;
}
