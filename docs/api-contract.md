# API Contract

This project currently uses local-first storage for analytics and leaderboards. The production API
should preserve the same client contract so the front end can switch implementations without a
rewrite.

Current client behavior:

- tries remote API first
- falls back to local storage when remote APIs fail
- never blocks gameplay on analytics or leaderboard failures

## 1. Event ingestion

### `POST /api/event`

Request:

```json
{
  "events": [
    {
      "eventName": "level_complete",
      "gameId": "tap-sprint",
      "sessionId": "s_xxx",
      "anonymousUserId": "u_xxx",
      "levelNumber": 4,
      "metadata": {
        "durationMs": 1980
      },
      "queuedAt": 1760000000000
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "accepted": 1
}
```

Validation rules:

- max 50 events per request
- reject unknown `gameId`
- reject oversized metadata
- accept writes asynchronously when possible

## 2. Leaderboard read

### `GET /api/leaderboard?game=tap-sprint&limit=10`

Response:

```json
{
  "source": "remote",
  "entries": [
    {
      "displayName": "Player A1B2",
      "bestLevel": 9,
      "bestTimeMs": 12400,
      "totalAttempts": 3,
      "updatedAt": 1760000000000
    }
  ]
}
```

## 3. Leaderboard submit

### `POST /api/leaderboard/submit`

Request:

```json
{
  "gameId": "find-the-one",
  "anonymousUserId": "u_xxx",
  "displayName": "Kai",
  "bestLevel": 9,
  "bestTimeMs": 15800,
  "totalAttempts": 4
}
```

Response:

```json
{
  "ok": true,
  "accepted": true,
  "source": "remote"
}
```

Validation rules:

- reject impossible level values
- clamp display names
- update only when run is better than stored record
- apply rate limiting per IP and anonymous user id

## 4. Recommended deployment model

### Option A: Cloudflare Pages + Functions

- static site on Pages
- `/api/*` handled by Pages Functions
- KV or D1 for cache/supporting data
- Postgres or Supabase for durable leaderboard storage

### Option B: Cloudflare Pages + Supabase

- static site on Pages
- event and leaderboard endpoints implemented as Supabase Edge Functions
- Postgres handles storage and SQL aggregation

For this project, Option B is the easiest operationally once real traffic arrives.
