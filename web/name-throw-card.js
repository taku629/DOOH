const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const THROW_THRESHOLD = 92;
const MAX_PULL = 176;

function createInkField(canvas, host, projectile) {
  const context = canvas?.getContext("2d");
  if (!context) return { setCharge() {}, burst() {}, resize() {}, destroy() {} };
  const colors = ["91,143,181", "130,173,115", "239,165,72", "228,86,82", "139,125,180"];
  const particles = [];
  let charge = 0;
  let frame = 0;
  let lastTime = 0;

  const resize = () => {
    const rect = host.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const addParticle = (origin, burst = false) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 18 + Math.random() * (burst ? 86 : 54);
    particles.push({
      x: origin.x + Math.cos(angle) * radius,
      y: origin.y + Math.sin(angle) * radius * .55,
      vx: Math.cos(angle) * (burst ? 2.8 : .35),
      vy: burst ? -3.5 - Math.random() * 5 : -.35 - charge * 1.4,
      life: 1,
      decay: burst ? .03 + Math.random() * .022 : .018 + Math.random() * .012,
      size: 2.2 + Math.random() * (2.2 + charge * 2.4),
      color: colors[Math.floor(Math.random() * colors.length)],
      phase: Math.random() * Math.PI * 2,
    });
  };

  const draw = (time) => {
    const rect = host.getBoundingClientRect();
    const projectileRect = projectile.getBoundingClientRect();
    const origin = {
      x: projectileRect.left - rect.left + projectileRect.width / 2,
      y: projectileRect.top - rect.top + projectileRect.height / 2,
    };
    context.clearRect(0, 0, rect.width, rect.height);
    context.globalCompositeOperation = "lighter";
    if (charge > .08 && time - lastTime > 105 - charge * 42) {
      addParticle(origin);
      if (particles.length > 22) particles.splice(0, particles.length - 22);
      lastTime = time;
    }
    particles.forEach((particle) => {
      particle.phase += .045 + charge * .06;
      particle.vx += Math.sin(particle.phase) * .018;
      particle.vy -= .006 + charge * .018;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= particle.decay;
      const alpha = Math.max(0, particle.life) * (.1 + charge * .28);
      const tail = 14 + charge * 22;
      const gradient = context.createLinearGradient(particle.x, particle.y + tail, particle.x, particle.y - tail);
      gradient.addColorStop(0, `rgba(${particle.color},0)`);
      gradient.addColorStop(1, `rgba(${particle.color},${alpha})`);
      context.strokeStyle = gradient;
      context.lineWidth = particle.size;
      context.beginPath();
      context.moveTo(particle.x - particle.vx * 3, particle.y - particle.vy * 5 + tail);
      context.quadraticCurveTo(
        particle.x + Math.sin(particle.phase) * 7,
        particle.y + tail * .25,
        particle.x,
        particle.y - tail
      );
      context.stroke();
    });
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      if (particles[index].life <= 0 || particles[index].y < -40) particles.splice(index, 1);
    }
    frame = requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener("resize", resize);
  frame = requestAnimationFrame(draw);
  return {
    setCharge(value) { charge = Math.max(0, Math.min(1, value)); },
    resize,
    burst() {
      const rect = host.getBoundingClientRect();
      const projectileRect = projectile.getBoundingClientRect();
      const origin = {
        x: projectileRect.left - rect.left + projectileRect.width / 2,
        y: projectileRect.top - rect.top + projectileRect.height / 2,
      };
      for (let index = 0; index < 12; index += 1) addParticle(origin, true);
    },
    destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    },
  };
}

export function mountNameThrowCard({ card, button, submit, getCopy }) {
  if (!card || !button || typeof submit !== "function") return null;

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "name-throw-handle";
  handle.hidden = true;
  handle.innerHTML = `
    <span class="name-throw-header" aria-hidden="true">
      <span class="name-throw-brand"><i></i><b>新宿DOOH</b></span>
      <span class="name-throw-connected"><i></i>DOOH 接続中</span>
    </span>
    <span class="name-throw-intro" aria-hidden="true">
      このスマホは新宿の大型画面とつながっています
    </span>
    <span class="name-throw-target" aria-hidden="true">
      <b>TO SHINJUKU DOOH ↑</b>
    </span>
    <span class="name-throw-beam" aria-hidden="true"></span>
    <canvas class="name-throw-ink-field" aria-hidden="true"></canvas>
    <span class="name-throw-ripples" aria-hidden="true">
      <i></i><i></i><i></i><i></i>
    </span>
    <span class="name-throw-flight" aria-hidden="true">
      <i class="name-throw-flight-glow"></i>
      <i class="name-throw-chevron"></i>
      <i class="name-throw-chevron"></i>
      <i class="name-throw-chevron"></i>
      <i class="name-throw-chevron"></i>
      <i class="name-throw-arrowhead"></i>
    </span>
    <span class="name-throw-effects" aria-hidden="true">
      <b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b>
      <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    </span>
    <span class="name-throw-coach" aria-hidden="true">
      <b>引いて、彩りを届けよう</b>
      <small>名前を下へ引いて、離す</small>
    </span>
    <span class="name-throw-projectile">
      <strong data-name-throw-value></strong>
      <small data-name-throw-hint></small>
    </span>
    <span class="name-throw-bow" aria-hidden="true">
      <svg viewBox="0 0 300 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="nameThrowLimbGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#4f8db1"></stop>
            <stop offset=".48" stop-color="#d9ae68"></stop>
            <stop offset="1" stop-color="#df765c"></stop>
          </linearGradient>
        </defs>
        <path class="name-throw-limb-shadow" d="M8 59 C58 58 97 18 150 20 C203 18 242 58 292 59 L287 69 C235 68 199 31 150 32 C101 31 65 68 13 69 Z"></path>
        <path class="name-throw-limb" d="M8 56 C59 55 98 15 150 17 C202 15 241 55 292 56 L287 65 C236 64 199 28 150 29 C101 28 64 64 13 65 Z"></path>
        <path class="name-throw-limb-highlight" d="M16 57 C65 54 101 20 150 22 C199 20 235 54 284 57"></path>
        <path class="name-throw-arc name-throw-arc-blue" d="M8 54 C62 52 99 13 150 15"></path>
        <path class="name-throw-arc name-throw-arc-warm" d="M292 54 C238 52 201 13 150 15"></path>
        <path class="name-throw-string name-throw-string-blue" d="M2 50 L150 78"></path>
        <path class="name-throw-string name-throw-string-warm" d="M298 57 L150 78"></path>
        <circle class="name-throw-anchor-ring" cx="9" cy="57" r="5"></circle>
        <circle class="name-throw-anchor name-throw-anchor-blue" cx="9" cy="57" r="2.6"></circle>
        <circle class="name-throw-anchor-ring" cx="291" cy="57" r="5"></circle>
        <circle class="name-throw-anchor name-throw-anchor-warm" cx="291" cy="57" r="2.6"></circle>
        <circle class="name-throw-knot-halo" cx="150" cy="68" r="8"></circle>
        <circle class="name-throw-knot" cx="150" cy="68" r="3"></circle>
      </svg>
    </span>
    <span class="name-throw-finger" aria-hidden="true"><i></i></span>
    <span class="name-throw-copy">
      <strong data-name-throw-gesture></strong>
      <small data-name-throw-fallback></small>
    </span>
  `;
  const actions = button.closest(".actions");
  if (actions?.parentElement === card) {
    card.insertBefore(handle, actions);
  } else {
    card.append(handle);
  }

  const value = handle.querySelector("[data-name-throw-value]");
  const hint = handle.querySelector("[data-name-throw-hint]");
  const gesture = handle.querySelector("[data-name-throw-gesture]");
  const fallback = handle.querySelector("[data-name-throw-fallback]");
  const bowSvg = handle.querySelector(".name-throw-bow svg");
  const leftString = handle.querySelector(".name-throw-string-blue");
  const rightString = handle.querySelector(".name-throw-string-warm");
  const bowKnot = handle.querySelector(".name-throw-knot");
  const bowKnotHalo = handle.querySelector(".name-throw-knot-halo");
  const inkField = createInkField(
    handle.querySelector(".name-throw-ink-field"),
    handle,
    handle.querySelector(".name-throw-projectile")
  );
  let running = false;
  let dragging = false;
  let startY = 0;
  let pull = 0;

  const copyNow = () => getCopy?.() || {};

  const syncBow = (distance = 0) => {
    const knotY = 68 + distance;
    bowSvg?.setAttribute("viewBox", `0 0 300 ${100 + distance}`);
    leftString?.setAttribute("d", `M9 57 L150 ${knotY}`);
    rightString?.setAttribute("d", `M291 57 L150 ${knotY}`);
    bowKnot?.setAttribute("cy", String(knotY));
    bowKnotHalo?.setAttribute("cy", String(knotY));
  };

  const resetPull = (didCancel = false) => {
    pull = 0;
    handle.style.setProperty("--name-throw-pull", "0px");
    handle.style.setProperty("--name-throw-charge", "0");
    inkField.setCharge(0);
    syncBow(0);
    handle.classList.remove("is-dragging", "is-ready");
    const copy = copyNow();
    gesture.textContent = didCancel ? (copy.retry || copy.gesture || "") : (copy.gesture || "");
  };

  const update = () => {
    const copy = copyNow();
    const name = String(copy.name || "").trim();
    value.textContent = name || (copy.empty || "名前を入力");
    value.dataset.tickerFont = copy.font || "noto";
    hint.textContent = name ? (copy.pull || "つかんで下へ") : (copy.emptyHint || "上の入力欄に名前を入れてください");
    gesture.textContent = copy.gesture || "";
    fallback.textContent = copy.fallback || "";
    handle.classList.toggle("has-name", Boolean(name));
    handle.hidden = !name;
    if (name) requestAnimationFrame(() => inkField.resize());
    handle.setAttribute("aria-label", name ? (copy.label || copy.gesture || "") : hint.textContent);
    handle.setAttribute("aria-disabled", String(!name));
  };

  const run = async () => {
    if (running) return false;
    const copy = copyNow();
    if (!String(copy.name || "").trim()) {
      return submit();
    }
    running = true;
    dragging = false;
    handle.classList.remove("is-dragging", "is-ready", "is-returning");
    handle.classList.add("is-firing");
    inkField.burst();
    const [ok] = await Promise.all([
      Promise.resolve().then(submit).catch(() => false),
      wait(720),
    ]);
    if (!ok) {
      handle.classList.remove("is-firing");
      handle.classList.add("is-returning");
      resetPull(true);
      window.setTimeout(() => handle.classList.remove("is-returning"), 620);
    }
    running = false;
    return ok;
  };

  handle.addEventListener("pointerdown", (event) => {
    if (running || !handle.classList.contains("has-name")) return;
    dragging = true;
    startY = event.clientY;
    pull = 0;
    handle.classList.add("is-dragging");
    handle.setPointerCapture?.(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!dragging || running) return;
    pull = Math.max(0, Math.min(MAX_PULL, event.clientY - startY));
    const charge = Math.min(1, pull / THROW_THRESHOLD);
    handle.style.setProperty("--name-throw-pull", `${pull}px`);
    handle.style.setProperty("--name-throw-charge", charge.toFixed(3));
    inkField.setCharge(charge);
    syncBow(pull);
    handle.classList.toggle("is-ready", pull >= THROW_THRESHOLD);
    const copy = copyNow();
    gesture.textContent = pull >= THROW_THRESHOLD
      ? (copy.release || "離して、名前を放つ")
      : (copy.charging || "もう少し下へ");
  });

  const finishDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (pull >= THROW_THRESHOLD) {
      run();
    } else {
      handle.classList.add("is-returning");
      resetPull(true);
      window.setTimeout(() => handle.classList.remove("is-returning"), 620);
    }
  };
  handle.addEventListener("pointerup", finishDrag);
  handle.addEventListener("pointercancel", finishDrag);

  handle.addEventListener("click", (event) => {
    if (event.detail === 0) run();
  });
  button.addEventListener("click", run);
  syncBow(0);
  update();
  return { run, update };
}
