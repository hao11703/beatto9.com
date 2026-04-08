const STORAGE_KEYS = {
  anonymousUserId: "beatto9.anonymousUserId",
  eventQueue: "beatto9.eventQueue",
  tapSprintBest: "beatto9.tapSprintBest",
  findTheOneBest: "beatto9.findTheOneBest",
};

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failure should not block gameplay.
  }
}

async function postQueuedEvents(events) {
  const response = await fetch("/api/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      events,
    }),
    keepalive: true,
  });

  if (!response.ok) {
    throw new Error("event_post_failed");
  }

  return response.json();
}

function createId(prefix) {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${Date.now().toString(36)}_${random[0].toString(36)}${random[1].toString(36)}`;
}

export function getAnonymousUserId() {
  let existing = null;

  try {
    existing = localStorage.getItem(STORAGE_KEYS.anonymousUserId);
  } catch {
    existing = null;
  }

  if (existing) {
    return existing;
  }

  const created = createId("u");

  try {
    localStorage.setItem(STORAGE_KEYS.anonymousUserId, created);
  } catch {
    // Ignore storage write failure and still return the generated id.
  }

  return created;
}

export function createSession(gameId) {
  return {
    id: createId("s"),
    gameId,
    anonymousUserId: getAnonymousUserId(),
    startedAt: Date.now(),
    runToken: null,
    tokenExpiresAt: null,
  };
}

export function queueEvent(event) {
  const current = readJson(STORAGE_KEYS.eventQueue, []);
  current.push({
    ...event,
    queuedAt: Date.now(),
  });
  writeJson(STORAGE_KEYS.eventQueue, current.slice(-100));
}

export function getQueuedEvents() {
  return readJson(STORAGE_KEYS.eventQueue, []);
}

export function clearQueuedEvents() {
  writeJson(STORAGE_KEYS.eventQueue, []);
}

export async function flushQueuedEvents() {
  const queued = getQueuedEvents();

  if (queued.length === 0) {
    return { delivered: 0, skipped: true };
  }

  if (!window.fetch) {
    return { delivered: 0, skipped: true };
  }

  try {
    await postQueuedEvents(queued);
    clearQueuedEvents();
    return { delivered: queued.length, skipped: false };
  } catch {
    return { delivered: 0, skipped: true };
  }
}

export function getTapSprintBest() {
  return readJson(STORAGE_KEYS.tapSprintBest, {
    bestLevel: 0,
    bestTimeMs: null,
  });
}

export function saveTapSprintBest(best) {
  writeJson(STORAGE_KEYS.tapSprintBest, best);
}

export function getFindTheOneBest() {
  return readJson(STORAGE_KEYS.findTheOneBest, {
    bestLevel: 0,
    bestTimeMs: null,
  });
}

export function saveFindTheOneBest(best) {
  writeJson(STORAGE_KEYS.findTheOneBest, best);
}

export async function startRemoteSession(session) {
  if (!window.fetch) {
    return session;
  }

  try {
    const response = await fetch("/api/session/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        gameId: session.gameId,
        anonymousUserId: session.anonymousUserId,
        sessionId: session.id,
      }),
      keepalive: true,
    });

    if (!response.ok) {
      return session;
    }

    const payload = await response.json();
    return {
      ...session,
      runToken: typeof payload?.token === "string" ? payload.token : null,
      tokenExpiresAt: typeof payload?.expiresAt === "number" ? payload.expiresAt : null,
    };
  } catch {
    return session;
  }
}
