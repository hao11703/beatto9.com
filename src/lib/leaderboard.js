const STORAGE_PREFIX = "beatto9.leaderboard";
const DEFAULT_LIMIT = 10;

function getStorageKey(gameId) {
  return `${STORAGE_PREFIX}.${gameId}`;
}

function readEntries(gameId) {
  try {
    const raw = localStorage.getItem(getStorageKey(gameId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeEntries(gameId, entries) {
  try {
    localStorage.setItem(getStorageKey(gameId), JSON.stringify(entries));
  } catch {
    // Storage writes should never block the game.
  }
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    if (right.bestLevel !== left.bestLevel) {
      return right.bestLevel - left.bestLevel;
    }

    const leftTime = left.bestTimeMs ?? Number.POSITIVE_INFINITY;
    const rightTime = right.bestTimeMs ?? Number.POSITIVE_INFINITY;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.updatedAt - right.updatedAt;
  });
}

function toPublicName(name, fallbackId) {
  const trimmed = (name || "").trim();

  if (trimmed) {
    return trimmed.slice(0, 18);
  }

  return `Player ${fallbackId.slice(-4).toUpperCase()}`;
}

async function fetchRemoteLeaderboard(gameId, limit) {
  if (!window.fetch) {
    return null;
  }

  try {
    const response = await fetch(
      `/api/leaderboard?game=${encodeURIComponent(gameId)}&limit=${encodeURIComponent(String(limit))}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.entries)) {
      return null;
    }

    return {
      source: payload.source || "remote",
      entries: payload.entries,
    };
  } catch {
    return null;
  }
}

async function submitRemoteLeaderboardEntry(payload) {
  if (!window.fetch) {
    return null;
  }

  try {
    const response = await fetch("/api/leaderboard/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

export async function getLeaderboard(gameId, limit = DEFAULT_LIMIT) {
  const remote = await fetchRemoteLeaderboard(gameId, limit);

  if (remote) {
    return remote;
  }

  return {
    source: "local",
    entries: sortEntries(readEntries(gameId)).slice(0, limit),
  };
}

export async function submitLeaderboardEntry({
  gameId,
  anonymousUserId,
  displayName,
  bestLevel,
  bestTimeMs,
  totalAttempts,
  sessionId,
  runToken,
}) {
  const payload = {
    gameId,
    anonymousUserId,
    displayName,
    bestLevel,
    bestTimeMs,
    totalAttempts,
    sessionId,
    runToken,
  };
  const remote = await submitRemoteLeaderboardEntry(payload);

  if (remote?.accepted) {
    return {
      source: remote.source || "remote",
      accepted: true,
      entry: null,
    };
  }

  const entries = readEntries(gameId);
  const existing = entries.find((entry) => entry.anonymousUserId === anonymousUserId);
  const nextUpdatedAt = Date.now();

  if (existing) {
    const improvedLevel = bestLevel > existing.bestLevel;
    const improvedTime =
      bestLevel === existing.bestLevel &&
      bestTimeMs !== null &&
      (existing.bestTimeMs === null || bestTimeMs < existing.bestTimeMs);

    if (!improvedLevel && !improvedTime) {
      return {
        source: "local",
        accepted: false,
        entry: existing,
      };
    }

    existing.bestLevel = bestLevel;
    existing.bestTimeMs = bestTimeMs ?? existing.bestTimeMs;
    existing.totalAttempts = totalAttempts;
    existing.updatedAt = nextUpdatedAt;
    existing.displayName = toPublicName(displayName, anonymousUserId);
  } else {
    entries.push({
      anonymousUserId,
      displayName: toPublicName(displayName, anonymousUserId),
      bestLevel,
      bestTimeMs: bestTimeMs ?? null,
      totalAttempts,
      updatedAt: nextUpdatedAt,
    });
  }

  const sorted = sortEntries(entries);
  writeEntries(gameId, sorted.slice(0, 100));

  return {
    source: "local",
    accepted: true,
    entry: sorted.find((entry) => entry.anonymousUserId === anonymousUserId) || null,
  };
}
