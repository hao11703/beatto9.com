import { clampInteger, getRateBucketKey, hasDb, isAllowedGame, json, rateLimit } from "./_shared.js";

const SAMPLE_DATA = {
  "tap-sprint": [
    {
      displayName: "Player T9A1",
      bestLevel: 9,
      bestTimeMs: 13200,
      totalAttempts: 4,
      updatedAt: Date.now(),
    },
  ],
  "find-the-one": [
    {
      displayName: "Player V3C8",
      bestLevel: 8,
      bestTimeMs: 14800,
      totalAttempts: 6,
      updatedAt: Date.now(),
    },
  ],
  "one-move-left": [
    {
      displayName: "Player L4Q7",
      bestLevel: 7,
      bestTimeMs: 16200,
      totalAttempts: 5,
      updatedAt: Date.now(),
    },
  ],
};

export async function onRequestGet(context) {
  const rate = await rateLimit(
    context,
    getRateBucketKey("leaderboard-read", context.request),
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

  const url = new URL(context.request.url);
  const game = url.searchParams.get("game") || "";
  const limit = clampInteger(url.searchParams.get("limit") || "10", 1, 20);

  if (!isAllowedGame(game)) {
    return json(
      {
        ok: false,
        error: "invalid_game",
      },
      { status: 400 }
    );
  }

  if (!hasDb(context)) {
    return json(
      {
        source: "stub",
        entries: (SAMPLE_DATA[game] || []).slice(0, limit),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  }

  const result = await context.env.DB.prepare(
    `SELECT display_name, best_level, best_time_ms, total_attempts, updated_at
     FROM leaderboard_entries
     WHERE game_id = ?
     ORDER BY best_level DESC, best_time_ms ASC, updated_at ASC
     LIMIT ?`
  )
    .bind(game, limit)
    .all();

  return json(
    {
      source: "d1",
      entries: (result.results || []).map((entry) => ({
        displayName: entry.display_name,
        bestLevel: entry.best_level,
        bestTimeMs: entry.best_time_ms,
        totalAttempts: entry.total_attempts,
        updatedAt: entry.updated_at,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30",
      },
    }
  );
}
