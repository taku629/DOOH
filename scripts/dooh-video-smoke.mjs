#!/usr/bin/env node
import http from "node:http";
import { createReadStream } from "node:fs";
import { stat, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { performance } from "node:perf_hooks";

const ROOT = resolve(process.cwd());
const OUT_DIR = process.env.DOOH_LOAD_OUT_DIR || "artifacts/load-test";
const CHROME = process.env.CHROME_PATH || "/home/takumu/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome";
const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (v) => Math.round(Number(v) * 10) / 10;

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}

async function startStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/demo.html";
      const candidate = normalize(join(ROOT, pathname));
      if (!candidate.startsWith(ROOT)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const st = await stat(candidate);
      if (!st.isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, {
        "content-type": MIME.get(extname(candidate)) || "application/octet-stream",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      });
      createReadStream(candidate).pipe(res);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, port: server.address().port };
}

async function launchChrome() {
  const remotePort = 9300 + Math.floor(Math.random() * 500);
  const userDataDir = `/tmp/dooh-video-chrome-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const args = [
    `--remote-debugging-port=${remotePort}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--autoplay-policy=no-user-gesture-required",
    "--mute-audio",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "about:blank",
  ];
  const chrome = spawn(CHROME, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const versionUrl = `http://127.0.0.1:${remotePort}/json/version`;
  const listUrl = `http://127.0.0.1:${remotePort}/json/list`;
  for (let i = 0; i < 80; i += 1) {
    try {
      const versionResponse = await fetch(versionUrl);
      const listResponse = await fetch(listUrl);
      if (versionResponse.ok && listResponse.ok) {
        const targets = await listResponse.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) {
          return { chrome, remotePort, wsUrl: page.webSocketDebuggerUrl, stderr: () => stderr };
        }
      }
    } catch {}
    await sleep(100);
  }
  chrome.kill("SIGTERM");
  throw new Error(`Chrome did not expose CDP. stderr=${stderr}`);
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }
  async open() {
    while (this.ws.readyState === WebSocket.CONNECTING) await sleep(10);
  }
  call(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30_000);
    });
  }
  async evaluate(expression, awaitPromise = true) {
    const result = await this.call("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
    }
    return result.result.value;
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

const MONITOR_SCRIPT = String.raw`
(() => {
  window.__videoMetrics = {
    startedAt: performance.now(),
    videos: {},
    playErrors: {},
    switchCounts: { warmReveal: 0, warmHide: 0, idleReveal: 0, idleHide: 0 },
    currentTimeStalls: 0,
    longTasks: [],
  };
  const labelOf = (video, index) => video.classList.contains('base-video') ? 'base' : video.classList.contains('warm-layer') ? 'clean' : video.classList.contains('idle-layer') ? 'idle' : 'video-' + index;
  const ensure = (label) => window.__videoMetrics.videos[label] ||= {
    pause: 0, ended: 0, error: 0, waiting: 0, stalled: 0, suspend: 0, playing: 0, timeupdate: 0,
    lastCurrentTime: 0, lastAdvanceAt: performance.now(), currentTimeStopped: 0, maxStillMs: 0,
    pausedSamples: 0, endedSamples: 0, errorSamples: 0,
  };
  const videos = [...document.querySelectorAll('video')];
  videos.forEach((video, index) => {
    const label = labelOf(video, index);
    const item = ensure(label);
    ['pause', 'ended', 'error', 'waiting', 'stalled', 'suspend', 'playing', 'timeupdate'].forEach((eventName) => {
      video.addEventListener(eventName, () => { item[eventName] = (item[eventName] || 0) + 1; }, true);
    });
    const originalPlay = video.play.bind(video);
    video.play = (...args) => {
      const promise = originalPlay(...args);
      if (promise && typeof promise.catch === 'function') {
        promise.catch((error) => {
          const key = (error?.name || 'Error') + ':' + (error?.message || String(error));
          window.__videoMetrics.playErrors[key] = (window.__videoMetrics.playErrors[key] || 0) + 1;
        });
      }
      return promise;
    };
  });
  const mo = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;
      const target = mutation.target;
      if (target.classList?.contains('warm-layer')) {
        if (target.classList.contains('is-revealed')) window.__videoMetrics.switchCounts.warmReveal += 1;
        else window.__videoMetrics.switchCounts.warmHide += 1;
      }
      if (target.classList?.contains('idle-layer')) {
        if (target.classList.contains('is-visible')) window.__videoMetrics.switchCounts.idleReveal += 1;
        else window.__videoMetrics.switchCounts.idleHide += 1;
      }
    }
  });
  videos.forEach((video) => mo.observe(video, { attributes: true, attributeFilter: ['class'] }));
  window.__videoMetricsObserver = mo;
  window.__videoMetricsTimer = setInterval(() => {
    const now = performance.now();
    videos.forEach((video, index) => {
      const label = labelOf(video, index);
      const item = ensure(label);
      if (video.paused) item.pausedSamples += 1;
      if (video.ended) item.endedSamples += 1;
      if (video.error) item.errorSamples += 1;
      const visible = label === 'base' || video.classList.contains('is-revealed') || video.classList.contains('is-visible');
      const nearNaturalEnd = Number.isFinite(video.duration) && video.duration > 0 && video.currentTime >= video.duration - 0.35;
      const shouldMove = visible && !video.paused && !video.ended && !video.error && video.readyState >= 2 && !nearNaturalEnd;
      if (!shouldMove) {
        item.lastCurrentTime = video.currentTime;
        item.lastAdvanceAt = now;
      } else if (Math.abs(video.currentTime - item.lastCurrentTime) >= 0.04 || video.currentTime < item.lastCurrentTime) {
        item.lastCurrentTime = video.currentTime;
        item.lastAdvanceAt = now;
      } else {
        const stillMs = now - item.lastAdvanceAt;
        item.maxStillMs = Math.max(item.maxStillMs, stillMs);
        if (stillMs > 1500) {
          item.currentTimeStopped += 1;
          window.__videoMetrics.currentTimeStalls += 1;
          item.lastAdvanceAt = now;
        }
      }
    });
  }, 250);
  try {
    const po = new PerformanceObserver((list) => {
      window.__videoMetrics.longTasks.push(...list.getEntries().map((e) => ({ duration: e.duration, startTime: e.startTime })).slice(-20));
      if (window.__videoMetrics.longTasks.length > 100) window.__videoMetrics.longTasks.splice(0, window.__videoMetrics.longTasks.length - 100);
    });
    po.observe({ entryTypes: ['longtask'] });
    window.__videoMetricsPerformanceObserver = po;
  } catch {}
  return true;
})()
`;

async function waitFor(cdp, expression, timeoutMs, label) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    const value = await cdp.evaluate(expression).catch(() => false);
    if (value) return value;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function runVideoScenario() {
  const args = parseArgs(process.argv);
  const isFast = args.has("fast");
  const fastParam = isFast ? "&fast" : "";
  await mkdir(OUT_DIR, { recursive: true });
  const { server, port } = await startStaticServer();
  const chromeInfo = await launchChrome();
  const cdp = new Cdp(chromeInfo.wsUrl);
  await cdp.open();
  await cdp.call("Runtime.enable");
  await cdp.call("Page.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const url = `http://127.0.0.1:${port}/demo.html?manual${fastParam}&debug`;
  await cdp.call("Page.navigate", { url });
  await waitFor(cdp, "document.readyState === 'complete' || document.readyState === 'interactive'", 20_000, "document ready");
  await waitFor(cdp, "Boolean(window.__inkDemo) && document.querySelectorAll('video').length >= 3", 20_000, "demo/video setup");
  await cdp.evaluate(MONITOR_SCRIPT);
  await cdp.evaluate("Promise.all([...document.querySelectorAll('video')].map(v => v.play().catch(e => String(e))))");
  await sleep(3000);

  const codecSupport = await cdp.evaluate(`(() => {
    const v = document.createElement('video');
    return {
      h264: v.canPlayType('video/mp4; codecs="avc1.42E01E"'),
      mp4: v.canPlayType('video/mp4'),
      webm: v.canPlayType('video/webm; codecs="vp8, vorbis"'),
    };
  })()`);

  const initial = await cdp.evaluate(`(() => [...document.querySelectorAll('video')].map(v => ({ className: v.className, src: v.currentSrc || v.src, readyState: v.readyState, paused: v.paused, currentTime: v.currentTime, duration: v.duration || 0 })))()`);

  await cdp.evaluate("window.__inkDemo.runResetCycleCheck()");
  await waitFor(cdp, "window.__inkDemo.getDebugLog().some(e => e.type === 'celebration:start')", 15_000, "celebration start");
  await waitFor(cdp, "window.__inkDemo.getDebugLog().some(e => e.type === 'celebration:finish')", 20_000, "celebration finish");
  const resetCycleState = await cdp.evaluate("window.__inkDemo.getDebugState()");

  await cdp.evaluate("window.__inkDemo.emergencyStop()");
  await sleep(6500);
  await waitFor(cdp, "window.__inkDemo.getDebugState().idleVideoActive === true || document.querySelector('.idle-layer')?.classList.contains('is-visible')", isFast ? 12_000 : 75_000, "idle visible");
  await waitFor(cdp, "window.__inkDemo.getDebugState().idleVideoActive === false && !document.querySelector('.idle-layer')?.classList.contains('is-visible')", isFast ? 15_000 : 20_000, "idle finished");
  const idleState = await cdp.evaluate("window.__inkDemo.getDebugState()");

  // 300人のライブカウント増分をUIへ流す。?fastでも1人ずつ反映するため最大4分待つ。
  await cdp.evaluate("window.__inkDemo.emergencyStop(); window.__inkDemo.activateLive(); window.__inkDemo.applyLiveCount(300)");
  await waitFor(cdp, "window.__inkDemo.getDebugState().visualizedLiveCount >= 300 && !window.__inkDemo.getDebugState().celebrationActive", 260_000, "300 live visual replay complete");
  const live300State = await cdp.evaluate("window.__inkDemo.getDebugState()");
  await sleep(1000);

  const metrics = await cdp.evaluate(`(() => {
    clearInterval(window.__videoMetricsTimer);
    window.__videoMetricsObserver?.disconnect?.();
    return {
      ...window.__videoMetrics,
      endedAt: performance.now(),
      debugLog: window.__inkDemo.getDebugLog(),
      debugState: window.__inkDemo.getDebugState(),
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      } : null,
    };
  })()`);
  const result = {
    url,
    chromePath: CHROME,
    codecSupport,
    initialVideos: initial,
    resetCycleState,
    idleState,
    live300State,
    metrics,
    summary: {
      currentTimeStalls: metrics.currentTimeStalls,
      videoPausedEvents: Object.fromEntries(Object.entries(metrics.videos).map(([k, v]) => [k, v.pause || 0])),
      videoEndedEvents: Object.fromEntries(Object.entries(metrics.videos).map(([k, v]) => [k, v.ended || 0])),
      videoErrorEvents: Object.fromEntries(Object.entries(metrics.videos).map(([k, v]) => [k, v.error || 0])),
      playErrors: metrics.playErrors,
      switchCounts: metrics.switchCounts,
      wallMs: round(metrics.endedAt - metrics.startedAt),
      longTaskCount: metrics.longTasks.length,
      maxLongTaskMs: round(metrics.longTasks.reduce((max, e) => Math.max(max, e.duration || 0), 0)),
      heapUsedMb: metrics.memory ? round(metrics.memory.usedJSHeapSize / 1024 / 1024) : null,
    },
  };
  result.passed = result.summary.currentTimeStalls === 0
    && Object.values(result.summary.videoErrorEvents).every((count) => count === 0)
    && Object.keys(result.summary.playErrors).length === 0
    && result.summary.switchCounts.warmReveal >= 1
    && result.summary.switchCounts.warmHide >= 1
    && result.summary.switchCounts.idleReveal >= 1
    && result.summary.switchCounts.idleHide >= 1
    && live300State.visualizedLiveCount >= 300;

  const started = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = `${OUT_DIR}/dooh-video-results-${started}.json`;
  await writeFile(jsonPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ jsonPath, passed: result.passed, summary: result.summary, codecSupport }, null, 2));

  cdp.close();
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  chromeInfo.chrome.kill("SIGTERM");
  chromeInfo.chrome.stdout?.destroy?.();
  chromeInfo.chrome.stderr?.destroy?.();
  chromeInfo.chrome.unref?.();
  await Promise.race([once(chromeInfo.chrome, "exit"), sleep(1000)]).catch(() => null);
}

runVideoScenario().catch((error) => {
  console.error("[video-smoke] failed", error);
  process.exitCode = 1;
});
