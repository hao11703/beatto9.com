import {
  getRateBucketKey,
  hasDb,
  isAllowedGame,
  isValidAnonymousUserId,
  json,
  rateLimit,
  sanitizeDisplayName,
  verifyRunToken,
} from "../_shared.js";

export async function onRequestPost(context) {
  try {
    const rate = await rateLimit(
      context,
      getRateBucketKey("leaderboard-submit", context.request),
      20,
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
    const gameId = typeof body?.gameId === "string" ? body.gameId : "";
    const anonymousUserId = typeof body?.anonymousUserId === "string" ? body.anonymousUserId : "";
    const bestLevel = typeof body?.bestLevel === "number" ? body.bestLevel : 0;
    const bestTimeMs = typeof body?.bestTimeMs === "number" ? body.bestTimeMs : null;
    const totalAttempts = typeof body?.totalAttempts === "number" ? body.totalAttempts : 1;
    const runToken = typeof body?.runToken === "string" ? body.runToken : "";
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";

    const maxAllowedTimeMs = 5 * 60 * 1000;
    const validBestTime =
      bestTimeMs === null ||
      (Number.isFinite(bestTimeMs) && bestTimeMs > 0 && bestTimeMs <= maxAllowedTimeMs);
    const validAttempts =
      Number.isFinite(totalAttempts) && totalAttempts >= 1 && totalAttempts <= 100000;

    if (
      !isAllowedGame(gameId) ||
      !isValidAnonymousUserId(anonymousUserId) ||
      bestLevel < 0 ||
      bestLevel > 9 ||
      !validBestTime ||
      !validAttempts ||
      !sessionId ||
      !runToken
    ) {
      return json(
        {
          ok: false,
          error: "invalid_payload",
        },
        { status: 400 }
      );
    }

    const verified = await verifyRunToken(runToken, context.env?.SESSION_SECRET || "");
    const tokenPayload = verified.payload || {};

    if (
      !verified.valid ||
      tokenPayload.gameId !== gameId ||
      tokenPayload.anonymousUserId !== anonymousUserId ||
      tokenPayload.sessionId !== sessionId ||
      typeof tokenPayload.expiresAt !== "number" ||
      tokenPayload.expiresAt < Date.now()
    ) {
      return json(
        {
          ok: false,
          error: "invalid_run_token",
        },
        { status: 403 }
      );
    }

    if (!hasDb(context)) {
      return json({
        ok: true,
        accepted: true,
        source: "stub",
      });
    }

    const db = context.env.DB;
    const now = Date.now();
    const displayName = sanitizeDisplayName(body?.displayName, anonymousUserId);
    const existing = await db
      .prepare(
        `SELECT best_level, best_time_ms
         FROM leaderboard_entries
         WHERE game_id = ? AND anonymous_user_id = ?
         LIMIT 1`
      )
      .bind(gameId, anonymousUserId)
      .first();

    let accepted = false;

    if (!existing) {
      await db
        .prepare(
          `INSERT INTO leaderboard_entries (
          game_id,
          anonymous_user_id,
          display_name,
          best_level,
          best_time_ms,
          total_attempts,
          updated_at,
          created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          gameId,
          anonymousUserId.slice(0, 80),
          displayName,
          bestLevel,
          bestTimeMs,
          Math.max(1, totalAttempts),
          now,
          now
        )
        .run();
      accepted = true;
    } else {
      const improvedLevel = bestLevel > existing.best_level;
      const improvedTime =
        bestLevel === existing.best_level &&
        bestTimeMs !== null &&
        (existing.best_time_ms === null || bestTimeMs < existing.best_time_ms);

      if (improvedLevel || improvedTime) {
        await db
          .prepare(
            `UPDATE leaderboard_entries
             SET display_name = ?, best_level = ?, best_time_ms = ?, total_attempts = ?, updated_at = ?
             WHERE game_id = ? AND anonymous_user_id = ?`
          )
          .bind(
            displayName,
            bestLevel,
            bestTimeMs,
            Math.max(1, totalAttempts),
            now,
            gameId,
            anonymousUserId.slice(0, 80)
          )
          .run();
        accepted = true;
      }
    }

    return json({
      ok: true,
      accepted,
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
