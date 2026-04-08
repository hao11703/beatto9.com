# Database Setup

## D1 schema

The SQL schema lives at:

- `db/schema.sql`

It creates:

- `game_events`
- `leaderboard_entries`

## Create the database

Example flow with Wrangler:

```bash
wrangler d1 create beatto9
```

Copy the returned database id into:

- `wrangler.toml`

## Apply the schema

```bash
wrangler d1 execute beatto9 --file=db/schema.sql
```

## What is stored

### `game_events`

- raw client analytics events
- useful for difficulty tuning and funnel analysis

### `leaderboard_entries`

- one row per `game_id + anonymous_user_id`
- only updated when a player improves

## Launch notes

- this is enough for MVP analytics and leaderboard storage
- it is not yet a full anti-cheat system
- if traffic grows, add rate limiting and anomaly review next
- signed-run verification also needs `SESSION_SECRET`
