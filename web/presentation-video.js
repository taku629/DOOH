(() => {
  const DURATION_MS = 30000;
  const SWIPE_TIMES = [4700, 5900, 7100, 8300];
  const FALLBACK_START = 20500;
  const FALLBACK_END = 25500;

  const $ = (id) => document.getElementById(id);
  const state = {
    startedAt: performance.now(),
    pausedAt: 0,
    paused: false,
    swipeIndex: 0,
    lastSecond: -1,
    fallbackStarted: false,
  };

  const elements = {
    stageProgress: $("stageProgress"),
    timecode: $("timecode"),
    doohScreen: $("doohScreen"),
    doohScene: $("doohScene"),
    doohWaiting: $("doohWaiting"),
    doohLit: $("doohLit"),
    doohFallback: $("doohFallback"),
    doohProgress: $("doohProgress"),
    doohRemaining: $("doohRemaining"),
    doohState: $("doohState"),
    doohCaption: $("doohCaption"),
    phoneCount: $("phoneCount"),
    phoneProgress: $("phoneProgress"),
    phoneRemaining: $("phoneRemaining"),
    phoneCaption: $("phoneCaption"),
    phoneSuccess: $("phoneSuccess"),
    swipeCta: $("swipeCta"),
    ctaLabel: $("ctaLabel"),
    swipeFinger: $("swipeFinger"),
    connection: document.querySelector(".connection-line"),
    storyCard: $("storyCard"),
    storyKicker: $("storyKicker"),
    storyTitle: $("storyTitle"),
    storyDetail: $("storyDetail"),
    endCard: $("endCard"),
    pauseButton: $("pauseButton"),
  };

  function currentTime() {
    if (state.paused) return state.pausedAt;
    return Math.min(DURATION_MS, performance.now() - state.startedAt);
  }

  function setStory(kicker, title, detail, visible = true) {
    elements.storyKicker.textContent = kicker;
    elements.storyTitle.textContent = title;
    elements.storyDetail.textContent = detail;
    elements.storyCard.classList.toggle("is-visible", visible);
  }

  function runSwipe(index) {
    state.swipeIndex = index + 1;
    elements.swipeFinger.classList.remove("is-swipe");
    void elements.swipeFinger.offsetWidth;
    elements.swipeFinger.classList.add("is-swipe");
    elements.swipeCta.classList.add("is-active");
    elements.phoneProgress.style.transform = `scaleX(${Math.min(1, 0.98 + state.swipeIndex * 0.005)})`;
    elements.phoneCaption.textContent = `スワイプ ${state.swipeIndex} / 4`;
    if (index === SWIPE_TIMES.length - 1) {
      elements.phoneCount.textContent = "50";
      elements.phoneRemaining.textContent = "達成";
      elements.ctaLabel.textContent = "参加しました";
    }
  }

  function updateStage(time) {
    const progress = Math.min(1, time / DURATION_MS);
    elements.stageProgress.style.width = `${progress * 100}%`;
    elements.timecode.textContent = `00:${String(Math.min(30, Math.floor(time / 1000))).padStart(2, "0")}`;

    SWIPE_TIMES.forEach((swipeTime, index) => {
      if (time >= swipeTime && state.swipeIndex <= index) runSwipe(index);
    });

    const isLit = time >= 9000 && time < FALLBACK_START;
    const isFallback = time >= FALLBACK_START && time < FALLBACK_END;
    const isEnd = time >= FALLBACK_END;

    elements.doohScene.classList.toggle("is-lit", isLit || isEnd);
    elements.doohWaiting.classList.toggle("is-hidden", isLit || isFallback || isEnd);
    elements.doohLit.classList.toggle("is-visible", isLit || isEnd);
    elements.doohFallback.classList.toggle("is-visible", isFallback);
    elements.doohScreen.classList.toggle("is-fallback", isFallback);
    elements.connection.classList.toggle("is-live", isLit || isEnd);
    elements.phoneSuccess.classList.toggle("is-visible", isLit || isEnd);
    elements.swipeCta.classList.toggle("is-active", time >= 7600 && time < FALLBACK_START);
    elements.endCard.classList.toggle("is-visible", isEnd);

    if (isLit) {
      elements.doohRemaining.textContent = "0";
      elements.doohState.textContent = "RELIGHT COMPLETE";
      elements.doohCaption.textContent = "参加で点灯しました";
      elements.doohCaption.className = "dooh-caption is-lit";
      elements.phoneCaption.textContent = "参加完了。DOOHに反映されました";
      setStory("REAL-TIME CONNECTION", "スワイプが、DOOHの色を変える。", "参加完了の瞬間に、新宿の画面が点灯。", true);
    } else if (isFallback) {
      elements.doohState.textContent = "FALLBACK FILM / 05 SEC";
      elements.doohCaption.textContent = "60秒スワイプなし → 5秒映像";
      elements.doohCaption.className = "dooh-caption is-fallback";
      elements.phoneCaption.textContent = "60秒スワイプがない場合";
      elements.doohProgress.style.width = `${((time - FALLBACK_START) / (FALLBACK_END - FALLBACK_START)) * 100}%`;
      setStory("NO SWIPE DETECTED", "参加がない時間も、画面は止まらない。", "60秒スワイプなしでフォールバック映像へ切り替え。", true);
    } else if (isEnd) {
      elements.doohState.textContent = "DEMO COMPLETE";
      elements.doohCaption.textContent = "Swipe to Relight Shinjuku";
      elements.doohCaption.className = "dooh-caption is-lit";
      setStory("THE LOOP", "みんなの参加で、街の夜を変える。", "スマホ参加 → DOOH演出 → 次の参加へ。", false);
    } else if (time < 4000) {
      elements.doohRemaining.textContent = "1";
      elements.doohState.textContent = "WAITING FOR ONE MORE";
      elements.doohCaption.textContent = "残り1人";
      elements.doohCaption.className = "dooh-caption";
      elements.phoneCaption.textContent = "参加者を待っています";
      setStory("THE IDEA", "スマホのひと swipe が、街の光になる。", "クラファン参加とDOOH演出をリアルタイムでつなぐ。", true);
    } else {
      elements.doohRemaining.textContent = "1";
      elements.doohState.textContent = "RECEIVING SWIPES";
      elements.doohCaption.textContent = "スワイプを受信中";
      elements.doohCaption.className = "dooh-caption";
      setStory("LIVE PARTICIPATION", "残り1人。あなたのスワイプを待っています。", "左の参加操作が右のDOOHへ即時に届く。", true);
    }

    if (isEnd) {
      elements.doohProgress.style.width = "100%";
    } else if (!isFallback) {
      elements.doohProgress.style.width = `${Math.min(100, Math.max(0, (time - 7600) / 1400 * 100))}%`;
    }

    const second = Math.floor(time / 1000);
    if (second !== state.lastSecond) {
      state.lastSecond = second;
      elements.pauseButton.textContent = state.paused ? "Play" : "Pause";
    }
  }

  function tick() {
    updateStage(currentTime());
    if (!state.paused && currentTime() < DURATION_MS) requestAnimationFrame(tick);
  }

  function replay() {
    state.startedAt = performance.now();
    state.pausedAt = 0;
    state.paused = false;
    state.swipeIndex = 0;
    state.lastSecond = -1;
    elements.phoneCount.textContent = "49";
    elements.phoneRemaining.textContent = "1人";
    elements.ctaLabel.textContent = "右へスワイプして参加";
    elements.phoneProgress.style.transform = "scaleX(.98)";
    elements.phoneSuccess.classList.remove("is-visible");
    elements.doohScene.classList.remove("is-lit");
    elements.doohScreen.classList.remove("is-fallback");
    updateStage(0);
    requestAnimationFrame(tick);
  }

  elements.pauseButton.addEventListener("click", () => {
    if (state.paused) {
      state.startedAt = performance.now() - state.pausedAt;
      state.paused = false;
      requestAnimationFrame(tick);
      return;
    }
    state.pausedAt = currentTime();
    state.paused = true;
    elements.pauseButton.textContent = "Play";
  });
  $("replayButton").addEventListener("click", replay);

  replay();
})();
