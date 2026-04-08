import {
  createSession,
  flushQueuedEvents,
  getAnonymousUserId,
  getFindTheOneBest,
  getQueuedEvents,
  queueEvent,
  saveFindTheOneBest,
  startRemoteSession,
} from "../lib/analytics.js";
import { getLeaderboard, submitLeaderboardEntry } from "../lib/leaderboard.js";

const GAME_ID = "find-the-one";
const LEVELS = [
  { size: 3, timeMs: 4500, delta: 16 },
  { size: 3, timeMs: 4200, delta: 13 },
  { size: 4, timeMs: 4000, delta: 12 },
  { size: 4, timeMs: 3600, delta: 10 },
  { size: 5, timeMs: 3400, delta: 9 },
  { size: 5, timeMs: 3100, delta: 8 },
  { size: 6, timeMs: 2900, delta: 7 },
  { size: 6, timeMs: 2600, delta: 6 },
  { size: 7, timeMs: 2300, delta: 5 },
];

const elements = {
  level: document.getElementById("vision-level-value"),
  grid: document.getElementById("vision-grid"),
  gridValue: document.getElementById("vision-grid-value"),
  timer: document.getElementById("vision-timer-value"),
  attempts: document.getElementById("vision-attempt-value"),
  message: document.getElementById("vision-message-text"),
  retryButton: document.getElementById("vision-retry-button"),
  progressFill: document.getElementById("vision-progress-fill"),
  bestLevel: document.getElementById("vision-best-level-value"),
  bestTime: document.getElementById("vision-best-time-value"),
  leaderboardList: document.getElementById("vision-leaderboard-list"),
};

const state = {
  session: createSession(GAME_ID),
  levelIndex: 0,
  timerId: null,
  levelStartAt: 0,
  remainingMs: LEVELS[0].timeMs,
  attempts: 1,
  totalRunTimeMs: 0,
  targetIndex: -1,
  locked: false,
};

function formatMs(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function setMessage(text) {
  elements.message.textContent = text;
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

function updateBestDisplay() {
  const best = getFindTheOneBest();
  elements.bestLevel.textContent = `${best.bestLevel}`;
  elements.bestTime.textContent = best.bestTimeMs ? formatMs(best.bestTimeMs) : "-";
}

function createPalette(delta) {
  const baseHue = 18 + state.levelIndex * 16;
  return {
    base: `hsl(${baseHue} 88% 58%)`,
    different: `hsl(${baseHue} 88% ${58 + delta}%)`,
  };
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

function render() {
  const level = LEVELS[state.levelIndex];
  elements.level.textContent = `${state.levelIndex + 1} / ${LEVELS.length}`;
  elements.gridValue.textContent = `${level.size} x ${level.size}`;
  elements.timer.textContent = formatMs(Math.max(0, state.remainingMs));
  elements.attempts.textContent = `${state.attempts}`;
  elements.progressFill.style.width = `${(state.levelIndex / LEVELS.length) * 100}%`;
}

function stopTimer() {
  window.clearInterval(state.timerId);
  state.timerId = null;
}

async function finishRun(success) {
  stopTimer();

  emitEvent("session_finish", {
    success,
    attempts: state.attempts,
    maxLevelReached: success ? LEVELS.length : state.levelIndex + 1,
    totalRunTimeMs: state.totalRunTimeMs,
    queuedEvents: getQueuedEvents().length,
  });

  if (!success) {
    return;
  }

  const previousBest = getFindTheOneBest();
  const nextBest = {
    bestLevel: LEVELS.length,
    bestTimeMs:
      previousBest.bestTimeMs === null
        ? state.totalRunTimeMs
        : Math.min(previousBest.bestTimeMs, state.totalRunTimeMs),
  };
  saveFindTheOneBest(nextBest);
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
  setMessage("You cleared all nine levels. Your local leaderboard run has been updated.");
}

function failLevel() {
  stopTimer();
  state.locked = true;

  const previous = getFindTheOneBest();
  saveFindTheOneBest({
    bestLevel: Math.max(previous.bestLevel, state.levelIndex),
    bestTimeMs: previous.bestTimeMs,
  });
  updateBestDisplay();

  emitEvent("level_fail", {
    targetIndex: state.targetIndex,
  });

  setMessage(`Level ${state.levelIndex + 1} failed. Retry to start a fresh run.`);
}

function startTimer() {
  state.levelStartAt = Date.now();
  emitEvent("level_start", {
    size: LEVELS[state.levelIndex].size,
    timeMs: LEVELS[state.levelIndex].timeMs,
    targetIndex: state.targetIndex,
  });

  state.timerId = window.setInterval(() => {
    const elapsed = Date.now() - state.levelStartAt;
    state.remainingMs = LEVELS[state.levelIndex].timeMs - elapsed;

    if (state.remainingMs <= 0) {
      state.remainingMs = 0;
      render();
      failLevel();
      return;
    }

    render();
  }, 50);
}

function createCell(index, palette) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vision-cell";
  button.style.background = index === state.targetIndex ? palette.different : palette.base;
  button.setAttribute("aria-label", `Tile ${index + 1}`);

  button.addEventListener("click", async () => {
    if (state.locked || state.timerId === null) {
      return;
    }

    if (index !== state.targetIndex) {
      emitEvent("wrong_pick", { pickedIndex: index, targetIndex: state.targetIndex });
      failLevel();
      return;
    }

    state.locked = true;
    const duration = Date.now() - state.levelStartAt;
    state.totalRunTimeMs += duration;
    emitEvent("level_complete", { durationMs: duration });

    stopTimer();

    if (state.levelIndex >= LEVELS.length - 1) {
      await finishRun(true);
      return;
    }

    state.levelIndex += 1;
    state.remainingMs = LEVELS[state.levelIndex].timeMs;
    state.locked = false;
    setMessage(`Nice. Level ${state.levelIndex + 1} is live.`);
    mountLevel();
  });

  return button;
}

function mountLevel() {
  const level = LEVELS[state.levelIndex];
  const totalCells = level.size * level.size;
  const palette = createPalette(level.delta);

  state.targetIndex = Math.floor(Math.random() * totalCells);
  elements.grid.innerHTML = "";
  elements.grid.style.setProperty("--grid-columns", `${level.size}`);

  for (let index = 0; index < totalCells; index += 1) {
    elements.grid.appendChild(createCell(index, palette));
  }

  state.locked = false;
  render();
  startTimer();
}

async function resetRun() {
  if (state.timerId !== null) {
    emitEvent("session_finish", {
      success: false,
      abandoned: true,
      attempts: state.attempts,
      maxLevelReached: state.levelIndex + 1,
      totalRunTimeMs: state.totalRunTimeMs,
    });
  }

  stopTimer();
  state.session = await startRemoteSession(createSession(GAME_ID));
  state.levelIndex = 0;
  state.remainingMs = LEVELS[0].timeMs;
  state.attempts += 1;
  state.totalRunTimeMs = 0;
  state.locked = false;
  emitEvent("retry_click", { attempts: state.attempts });
  emitEvent("session_start", { source: "retry", anonymousUserId: getAnonymousUserId() });
  setMessage("Fresh run started. Find the different tile before time runs out.");
  mountLevel();
}

async function init() {
  state.session = await startRemoteSession(state.session);
  updateBestDisplay();
  await refreshLeaderboard();
  emitEvent("page_view");
  emitEvent("session_start", { source: "page_load", queuedEvents: getQueuedEvents().length });
  mountLevel();

  elements.retryButton.addEventListener("click", () => {
    resetRun();
  });

  window.addEventListener("pagehide", () => {
    emitEvent("page_hide", {
      currentLevel: state.levelIndex + 1,
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
