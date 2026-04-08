import {
  createSession,
  flushQueuedEvents,
  getAnonymousUserId,
  getQueuedEvents,
  getTapSprintBest,
  queueEvent,
  saveTapSprintBest,
  startRemoteSession,
} from "../lib/analytics.js";
import { getLeaderboard, submitLeaderboardEntry } from "../lib/leaderboard.js";

const GAME_ID = "tap-sprint";
const LEVELS = [
  { target: 12, timeMs: 4800 },
  { target: 16, timeMs: 4600 },
  { target: 22, timeMs: 4300 },
  { target: 28, timeMs: 3900 },
  { target: 36, timeMs: 3600 },
  { target: 45, timeMs: 3300 },
  { target: 56, timeMs: 3000 },
  { target: 68, timeMs: 2800 },
  { target: 84, timeMs: 2600 },
];

const elements = {
  level: document.getElementById("level-value"),
  target: document.getElementById("target-value"),
  targetMirror: document.getElementById("tap-target-mirror"),
  timer: document.getElementById("timer-value"),
  attempts: document.getElementById("attempt-value"),
  tapZone: document.getElementById("tap-zone"),
  tapZoneText: document.getElementById("tap-zone-text"),
  tapCount: document.getElementById("tap-count"),
  message: document.getElementById("message-text"),
  retryButton: document.getElementById("retry-button"),
  progressFill: document.getElementById("progress-fill"),
  bestLevel: document.getElementById("best-level-value"),
  bestTime: document.getElementById("best-time-value"),
  leaderboardList: document.getElementById("leaderboard-list"),
  focus: document.getElementById("focus-value"),
};

const state = {
  session: createSession(GAME_ID),
  levelIndex: 0,
  tapCount: 0,
  timerId: null,
  levelStartAt: 0,
  remainingMs: LEVELS[0].timeMs,
  runStarted: false,
  attempts: 1,
  totalRunTimeMs: 0,
  combo: 0,
  bestCombo: 0,
  lastTapAt: 0,
  feverActive: false,
  timeBonusMs: 0,
  awardedMilestones: new Set(),
};

function getLevelBudgetMs() {
  return LEVELS[state.levelIndex].timeMs + state.timeBonusMs;
}

function updateTapMood() {
  elements.focus.textContent = state.feverActive
    ? "Fever"
    : state.combo >= 5
      ? `Combo x${state.combo}`
      : `x${state.combo}`;

  elements.tapZoneText.textContent = state.feverActive
    ? "Fever: every tap hits harder"
    : state.combo >= 4
      ? `Combo x${state.combo} is active`
      : state.runStarted
        ? "Keep the rhythm alive"
        : "Tap to start the timer";

  document.body.classList.toggle("tap-fever", state.feverActive);
  elements.tapZone.classList.toggle("tap-zone-fever", state.feverActive);
}

function formatMs(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function setMessage(text) {
  elements.message.textContent = text;
}

function updateBestDisplay() {
  const best = getTapSprintBest();
  elements.bestLevel.textContent = `${best.bestLevel}`;
  elements.bestTime.textContent = best.bestTimeMs ? formatMs(best.bestTimeMs) : "-";
}

function renderLeaderboard(entries) {
  if (entries.length === 0) {
    elements.leaderboardList.innerHTML = "<li>No local runs yet.</li>";
    return;
  }

  elements.leaderboardList.innerHTML = entries
    .map((entry) => {
      const timeLabel = entry.bestTimeMs ? formatMs(entry.bestTimeMs) : "-";
      return `<li><span>${entry.displayName}</span><strong>L${entry.bestLevel} · ${timeLabel}</strong></li>`;
    })
    .join("");
}

async function refreshLeaderboard() {
  const leaderboard = await getLeaderboard(GAME_ID, 5);
  renderLeaderboard(leaderboard.entries);
}

function emitEvent(eventName, metadata = {}) {
  queueEvent({
    eventName,
    gameId: GAME_ID,
    sessionId: state.session.id,
    anonymousUserId: state.session.anonymousUserId,
    levelNumber: state.levelIndex + 1,
    metadata,
  });
}

function render() {
  const level = LEVELS[state.levelIndex];
  const progress = ((state.levelIndex + (state.tapCount >= level.target ? 1 : 0)) / LEVELS.length) * 100;

  elements.level.textContent = `${state.levelIndex + 1} / ${LEVELS.length}`;
  elements.target.textContent = `${level.target}`;
  elements.targetMirror.textContent = `${level.target}`;
  elements.timer.textContent = formatMs(Math.max(0, state.remainingMs));
  elements.attempts.textContent = `${state.attempts}`;
  elements.tapCount.textContent = `${state.tapCount}`;
  elements.progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  updateTapMood();
}

async function finishRun(success) {
  window.clearInterval(state.timerId);
  state.timerId = null;

  emitEvent("session_finish", {
    success,
    attempts: state.attempts,
    maxLevelReached: success ? LEVELS.length : state.levelIndex + 1,
    totalRunTimeMs: state.totalRunTimeMs,
    queuedEvents: getQueuedEvents().length,
  });

  if (success) {
    const best = getTapSprintBest();
    const nextBest = {
      bestLevel: LEVELS.length,
      bestTimeMs:
        best.bestTimeMs === null ? state.totalRunTimeMs : Math.min(best.bestTimeMs, state.totalRunTimeMs),
    };
    saveTapSprintBest(nextBest);
    updateBestDisplay();
    await submitLeaderboardEntry({
      gameId: GAME_ID,
      anonymousUserId: state.session.anonymousUserId,
      displayName: "",
      bestLevel: LEVELS.length,
      bestTimeMs: state.totalRunTimeMs,
      totalAttempts: state.attempts,
      sessionId: state.session.id,
      runToken: state.session.runToken,
    });
    await refreshLeaderboard();
    setMessage("You beat all nine levels. This run is stored locally and ready for leaderboard wiring.");
  }
}

async function goToNextLevel() {
  const completedLevel = state.levelIndex + 1;
  const duration = Date.now() - state.levelStartAt;

  state.totalRunTimeMs += duration;
  emitEvent("level_complete", {
    durationMs: duration,
    tapCount: state.tapCount,
  });

  if (completedLevel >= LEVELS.length) {
    await finishRun(true);
    return;
  }

  state.levelIndex += 1;
  state.tapCount = 0;
  state.runStarted = false;
  state.remainingMs = LEVELS[state.levelIndex].timeMs;
  state.levelStartAt = 0;
  state.combo = 0;
  state.lastTapAt = 0;
  state.feverActive = false;
  state.timeBonusMs = 0;
  state.awardedMilestones = new Set();
  setMessage(`Level ${completedLevel} cleared. Get ready for Level ${state.levelIndex + 1}.`);
  render();
}

function failLevel() {
  window.clearInterval(state.timerId);
  state.timerId = null;
  state.feverActive = false;

  const maxLevel = Math.max(getTapSprintBest().bestLevel, state.levelIndex);
  saveTapSprintBest({
    ...getTapSprintBest(),
    bestLevel: maxLevel,
  });
  updateBestDisplay();

  emitEvent("level_fail", {
    tapCount: state.tapCount,
    requiredTaps: LEVELS[state.levelIndex].target,
  });

  setMessage(`Level ${state.levelIndex + 1} failed. Tap retry and try to beat your best.`);
}

function startLevelTimer() {
  state.runStarted = true;
  state.levelStartAt = Date.now();
  emitEvent("level_start", {
    target: LEVELS[state.levelIndex].target,
    timeMs: getLevelBudgetMs(),
  });

  state.timerId = window.setInterval(() => {
    const elapsed = Date.now() - state.levelStartAt;
    state.remainingMs = getLevelBudgetMs() - elapsed;
    const feverThreshold = Math.max(900, getLevelBudgetMs() * 0.34);
    state.feverActive = state.levelIndex >= 3 && state.remainingMs <= feverThreshold;

    if (state.remainingMs <= 0) {
      state.remainingMs = 0;
      render();
      failLevel();
      return;
    }

    render();
  }, 50);
}

function handleTap() {
  if (!state.runStarted && state.timerId === null) {
    startLevelTimer();
  }

  if (state.timerId === null) {
    return;
  }

  const now = Date.now();
  state.combo = now - state.lastTapAt <= 420 ? state.combo + 1 : 1;
  state.lastTapAt = now;
  state.bestCombo = Math.max(state.bestCombo, state.combo);

  let tapGain = state.feverActive ? 2 : 1;
  const milestone = Math.floor(state.combo / 6);
  if (milestone > 0 && !state.awardedMilestones.has(milestone)) {
    state.awardedMilestones.add(milestone);
    tapGain += 1;
    state.timeBonusMs += 180;
    setMessage(`Combo x${state.combo}. Bonus tap and +0.2s time burst.`);
    emitEvent("combo_bonus", {
      combo: state.combo,
      bonusTap: 1,
      bonusTimeMs: 180,
      feverActive: state.feverActive,
    });
  } else if (state.feverActive && tapGain > 1) {
    setMessage("Fever mode is live. Each tap now hits twice.");
  }

  state.tapCount += tapGain;
  elements.tapCount.classList.remove("metric-pop");
  window.requestAnimationFrame(() => {
    elements.tapCount.classList.add("metric-pop");
  });
  render();

  if (state.tapCount >= LEVELS[state.levelIndex].target) {
    goToNextLevel();
  }
}

async function resetRun() {
  if (state.runStarted || state.tapCount > 0) {
    emitEvent("session_finish", {
      success: false,
      abandoned: true,
      attempts: state.attempts,
      maxLevelReached: state.levelIndex + 1,
      totalRunTimeMs: state.totalRunTimeMs,
    });
  }

  window.clearInterval(state.timerId);
  state.timerId = null;
  state.levelIndex = 0;
  state.tapCount = 0;
  state.remainingMs = LEVELS[0].timeMs;
  state.levelStartAt = 0;
  state.runStarted = false;
  state.totalRunTimeMs = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.lastTapAt = 0;
  state.feverActive = false;
  state.timeBonusMs = 0;
  state.awardedMilestones = new Set();
  state.attempts += 1;
  state.session = await startRemoteSession(createSession(GAME_ID));
  emitEvent("retry_click", { attempts: state.attempts });
  emitEvent("session_start", { source: "retry", anonymousUserId: getAnonymousUserId() });
  setMessage("Fresh run started. The timer begins on your first tap.");
  render();
}

async function init() {
  state.session = await startRemoteSession(state.session);
  updateBestDisplay();
  await refreshLeaderboard();
  emitEvent("page_view");
  emitEvent("session_start", { source: "page_load", queuedEvents: getQueuedEvents().length });
  render();

  elements.tapZone.addEventListener("pointerdown", handleTap, { passive: true });
  elements.retryButton.addEventListener("click", () => {
    resetRun();
  });

  window.addEventListener("pagehide", () => {
    emitEvent("page_hide", {
      currentLevel: state.levelIndex + 1,
      tapCount: state.tapCount,
      attempts: state.attempts,
    });
  });

  window.addEventListener("online", () => {
    flushQueuedEvents();
  });

  window.setTimeout(() => {
    flushQueuedEvents();
  }, 1200);
}

init();
