import {
  createSession,
  flushQueuedEvents,
  getAnonymousUserId,
  getQueuedEvents,
  queueEvent,
  startRemoteSession,
} from "../lib/analytics.js";
import { getLeaderboard, submitLeaderboardEntry } from "../lib/leaderboard.js";

const GAME_ID = "one-move-left";
const STORAGE_KEY = "beatto9.oneMoveLeftBest";
const LEVELS = [
  { size: 3, rows: 2, pattern: "row" },
  { size: 3, rows: 3, pattern: "reverse" },
  { size: 4, rows: 2, pattern: "snake" },
  { size: 4, rows: 3, pattern: "reverse" },
  { size: 4, rows: 4, pattern: "snake" },
  { size: 5, rows: 3, pattern: "column" },
  { size: 5, rows: 4, pattern: "reverse" },
  { size: 5, rows: 5, pattern: "snake" },
  { size: 6, rows: 5, pattern: "column" },
];

const elements = {
  level: document.getElementById("logic-level-value"),
  boardValue: document.getElementById("logic-board-value"),
  moves: document.getElementById("logic-moves-value"),
  attempts: document.getElementById("logic-attempt-value"),
  board: document.getElementById("logic-board"),
  message: document.getElementById("logic-message-text"),
  retryButton: document.getElementById("logic-retry-button"),
  progressFill: document.getElementById("logic-progress-fill"),
  bestLevel: document.getElementById("logic-best-level-value"),
  bestTime: document.getElementById("logic-best-time-value"),
  leaderboardList: document.getElementById("logic-leaderboard-list"),
  pattern: document.getElementById("logic-pattern-value"),
};

const state = {
  session: createSession(GAME_ID),
  levelIndex: 0,
  attempts: 1,
  totalRunTimeMs: 0,
  levelStartAt: 0,
  sequence: [],
  nextMoveIndex: 0,
  locked: false,
};

function getPatternLabel(pattern) {
  switch (pattern) {
    case "reverse":
      return "Reverse rows";
    case "snake":
      return "Snake path";
    case "column":
      return "Column climb";
    default:
      return "Ordered row clear";
  }
}

function readBest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { bestLevel: 0, bestTimeMs: null };
  } catch {
    return { bestLevel: 0, bestTimeMs: null };
  }
}

function writeBest(best) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
  } catch {
    // Ignore storage write errors.
  }
}

function formatMs(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
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

function setMessage(text) {
  elements.message.textContent = text;
}

function updateBestDisplay() {
  const best = readBest();
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

function renderStatus() {
  const level = LEVELS[state.levelIndex];
  elements.level.textContent = `${state.levelIndex + 1} / ${LEVELS.length}`;
  elements.boardValue.textContent = `${level.size} x ${level.size}`;
  elements.moves.textContent = `${state.sequence.length - state.nextMoveIndex}`;
  elements.attempts.textContent = `${state.attempts}`;
  elements.progressFill.style.width = `${(state.levelIndex / LEVELS.length) * 100}%`;
  elements.pattern.textContent = getPatternLabel(level.pattern);
}

function buildSequence(level) {
  const sequence = [];

  if (level.pattern === "column") {
    for (let x = 0; x < level.size; x += 1) {
      for (let y = 0; y < level.rows; y += 1) {
        sequence.push(`${x}:${y}`);
      }
    }
    return sequence;
  }

  for (let row = 0; row < level.rows; row += 1) {
    const y = row;
    const rowCells = [];
    for (let x = 0; x < level.size; x += 1) {
      rowCells.push(`${x}:${y}`);
    }

    if (level.pattern === "reverse" || (level.pattern === "snake" && row % 2 === 1)) {
      rowCells.reverse();
    }

    sequence.push(...rowCells);
  }

  return sequence;
}

function finishFailure(wrongKey) {
  state.locked = true;
  elements.board.classList.add("logic-board-fail");
  const previous = readBest();
  writeBest({
    bestLevel: Math.max(previous.bestLevel, state.levelIndex),
    bestTimeMs: previous.bestTimeMs,
  });
  updateBestDisplay();
  emitEvent("level_fail", {
    expectedMove: state.sequence[state.nextMoveIndex],
    wrongMove: wrongKey,
  });

  const expectedCell = elements.board.querySelector(`[data-key="${state.sequence[state.nextMoveIndex]}"]`);
  const wrongCell = wrongKey ? elements.board.querySelector(`[data-key="${wrongKey}"]`) : null;
  expectedCell?.classList.add("logic-cell-expected");
  wrongCell?.classList.add("logic-cell-wrong");
  setMessage(`Wrong move. Follow the ${getPatternLabel(LEVELS[state.levelIndex].pattern).toLowerCase()} path.`);
}

async function finishRun(success) {
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

  const previous = readBest();
  const nextBest = {
    bestLevel: LEVELS.length,
    bestTimeMs:
      previous.bestTimeMs === null ? state.totalRunTimeMs : Math.min(previous.bestTimeMs, state.totalRunTimeMs),
  };
  writeBest(nextBest);
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

async function completeLevel() {
  const duration = Date.now() - state.levelStartAt;
  state.totalRunTimeMs += duration;
  elements.board.classList.add("logic-board-success");
  emitEvent("level_complete", {
    durationMs: duration,
    moveCount: state.sequence.length,
  });

  if (state.levelIndex >= LEVELS.length - 1) {
    await finishRun(true);
    return;
  }

  state.levelIndex += 1;
  state.nextMoveIndex = 0;
  state.locked = false;
  setMessage(`Level cleared. Level ${state.levelIndex + 1} uses ${getPatternLabel(LEVELS[state.levelIndex].pattern).toLowerCase()}.`);
  mountLevel();
}

function handleCellClick(key) {
  if (state.locked) {
    return;
  }

  const expected = state.sequence[state.nextMoveIndex];
  if (key !== expected) {
    finishFailure(key);
    return;
  }

  const cell = elements.board.querySelector(`[data-key="${key}"]`);
  if (cell) {
    cell.classList.add("logic-cell-cleared");
    cell.classList.add("logic-cell-hit");
  }

  state.nextMoveIndex += 1;
  emitEvent("correct_move", {
    key,
    moveIndex: state.nextMoveIndex,
  });
  renderStatus();

  if (state.nextMoveIndex >= state.sequence.length) {
    completeLevel();
  }
}

function createCell(x, y, activeCells) {
  const key = `${x}:${y}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "logic-cell";
  if (activeCells.has(key)) {
    button.classList.add("logic-cell-active");
  }
  button.dataset.key = key;
  button.setAttribute("aria-label", `Cell ${x + 1}, ${y + 1}`);
  button.addEventListener("click", () => handleCellClick(key));
  return button;
}

function mountLevel() {
  const level = LEVELS[state.levelIndex];
  state.sequence = buildSequence(level);
  const activeCells = new Set(state.sequence);
  state.nextMoveIndex = 0;
  state.levelStartAt = Date.now();
  elements.board.innerHTML = "";
  elements.board.style.setProperty("--grid-columns", `${level.size}`);
  elements.board.classList.remove("logic-board-fail");
  elements.board.classList.remove("logic-board-success");

  for (let y = 0; y < level.size; y += 1) {
    for (let x = 0; x < level.size; x += 1) {
      elements.board.appendChild(createCell(x, y, activeCells));
    }
  }

  emitEvent("level_start", {
    size: level.size,
    rows: level.rows,
    moveCount: state.sequence.length,
    pattern: level.pattern,
  });
  renderStatus();
}

async function resetRun() {
  if (state.nextMoveIndex > 0) {
    emitEvent("session_finish", {
      success: false,
      abandoned: true,
      attempts: state.attempts,
      maxLevelReached: state.levelIndex + 1,
      totalRunTimeMs: state.totalRunTimeMs,
    });
  }

  state.session = await startRemoteSession(createSession(GAME_ID));
  state.levelIndex = 0;
  state.attempts += 1;
  state.totalRunTimeMs = 0;
  state.nextMoveIndex = 0;
  state.locked = false;
  emitEvent("retry_click", { attempts: state.attempts });
  emitEvent("session_start", { source: "retry", anonymousUserId: getAnonymousUserId() });
  setMessage("Fresh run started. Clear the active rows from left to right.");
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
      nextMoveIndex: state.nextMoveIndex,
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
