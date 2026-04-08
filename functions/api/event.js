import {
  getRateBucketKey,
  hasDb,
  isAllowedGame,
  isValidAnonymousUserId,
  isValidSessionId,
  json,
  rateLimit,
  safeJsonString,
} from "./_shared.js";

export async function onRequestPost(context) {
  try {
    const rate = await rateLimit(
      context,
      getRateBucketKey("event", context.request),
      120,
      60
    );

    if (!rate.allowed) {
      return json(
        {
          ok: false,
          error: "rate_limited",
        },
        { status: 429 }
      );
    }

    const body = await context.request.json();
    const events = Array.isArray(body?.events) ? body.events.slice(0, 50) : [];

    if (!hasDb(context)) {
      return json({
        ok: true,
        accepted: events.length,
        source: "stub",
      });
    }

    const validEvents = events.filter((event) => {
      return (
        event &&
        typeof event.eventName === "string" &&
        typeof event.gameId === "string" &&
        isAllowedGame(event.gameId) &&
        isValidSessionId(event.sessionId) &&
        isValidAnonymousUserId(event.anonymousUserId) &&
        (event.levelNumber === undefined ||
          (typeof event.levelNumber === "number" &&
            event.levelNumber >= 0 &&
            event.levelNumber <= 9))
      );
    });

    const db = context.env.DB;
    const timestamp = Date.now();

    for (const event of validEvents) {
      await db
        .prepare(
          `INSERT INTO game_events (
            event_name,
            game_id,
            session_id,
            anonymous_user_id,
            level_number,
            metadata_json,
            queued_at,
            received_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          event.eventName.slice(0, 64),
          event.gameId,
          event.sessionId.slice(0, 80),
          event.anonymousUserId.slice(0, 80),
          typeof event.levelNumber === "number" ? event.levelNumber : null,
          safeJsonString(event.metadata),
          typeof event.queuedAt === "number" ? event.queuedAt : null,
          timestamp
        )
        .run();
    }

    return json({
        ok: true,
        accepted: validEvents.length,
        source: "d1",
      });
  } catch {
    return json(
      {
        ok: false,
        error: "invalid_json",
      },
      { status: 400 }
    );
  }
}
