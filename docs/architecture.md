# Technical Architecture

## 1. Product shape

`beatto9.com` should begin as a performance-first challenge site:

- one lightweight landing page
- three fast-loading mini games
- shared leaderboard and analytics layer
- mobile-first interaction
- TikTok traffic as the first acquisition channel

The site should feel instant on mid-range mobile devices and degrade gracefully on slower connections.

## 2. Core architecture

### Frontend

- Static HTML, CSS, and ES modules
- No framework runtime in phase 1
- Route-level code splitting by page
- Game-level code splitting by individual game
- System fonts only in phase 1
- SVG/CSS visuals before adding image assets

### Backend

Recommended phase 1 stack:

- Static hosting: Cloudflare Pages
- API layer: Cloudflare Workers or Supabase Edge Functions
- Database: Supabase Postgres
- Optional cache: Cloudflare edge cache for leaderboard reads

This gives:

- high global availability
- low origin cost
- edge-near response time
- simple operational model

## 3. Non-functional requirements

### Performance

Targets for mobile web:

- HTML document under 20 KB compressed
- critical CSS under 8 KB compressed
- first route JS under 25 KB compressed
- first game module under 35 KB compressed
- Largest Contentful Paint under 1.8 s on 4G
- Time to Interactive under 2.0 s on typical mobile devices

Rules:

- no large JS frameworks until metrics justify them
- no autoplay video on landing page
- no custom web fonts in phase 1
- no analytics vendor bundle on first paint
- no image-heavy hero sections
- load game code only after explicit user intent

### Availability

Targets:

- static pages served from CDN edge
- no hard dependency on backend to render landing page
- leaderboard and analytics failures must not block gameplay
- retry logic for writes with client queue fallback

Design principles:

- static-first rendering
- backend only for dynamic enhancements
- graceful degradation when APIs fail

### Security and abuse resistance

Threats in phase 1:

- fake leaderboard submissions
- analytics spam
- scripted score inflation

Controls:

- rate limit write endpoints by IP and anonymous user id
- sign server-issued session tokens per gameplay run
- validate allowed score and level ranges server-side
- reject impossible timestamps and attempts
- store event fingerprints for anomaly review

## 4. Frontend page model

### Landing page

Purpose:

- explain the challenge in under 5 seconds
- get users into a game with minimal friction
- provide crawlable content for SEO

Content blocks:

- hero
- featured games
- leaderboard teaser
- daily challenge teaser
- FAQ
- footer with trust/legal links

### Game page

Purpose:

- launch one game instantly
- preload only the chosen game module
- keep navigation simple

Content blocks:

- compact header
- game canvas/container
- progress and session UI
- retry CTA
- leaderboard snapshot
- related game links

### Legal pages

Keep these static and lightweight:

- privacy policy
- terms of service

These support ad approvals, trust, and platform requirements.

## 5. Data architecture

### Tables

#### `games`

- `id`
- `slug`
- `title`
- `category`
- `status`
- `difficulty_profile`
- `created_at`

#### `game_sessions`

- `id`
- `game_id`
- `anonymous_user_id`
- `started_at`
- `ended_at`
- `max_level_reached`
- `attempt_count`
- `client_country`
- `session_signature`

#### `game_events`

- `id`
- `session_id`
- `game_id`
- `event_name`
- `level_number`
- `event_ts`
- `metadata`

#### `leaderboard_entries`

- `id`
- `game_id`
- `anonymous_user_id`
- `best_level`
- `best_time_ms`
- `total_attempts`
- `country_code`
- `created_at`
- `updated_at`

## 6. API boundaries

### Write endpoints

- `POST /api/session/start`
- `POST /api/event`
- `POST /api/session/finish`
- `POST /api/leaderboard/submit`

Rules:

- all writes should be small JSON payloads
- all writes should be asynchronous and non-blocking for gameplay
- use `navigator.sendBeacon` where possible for unload-safe writes

### Read endpoints

- `GET /api/leaderboard?game=...`
- `GET /api/daily-challenge`

Leaderboard reads are cache-friendly and should be edge-cached briefly.

## 7. SEO architecture

The site should avoid content bloat early. Start with:

- one home page
- one page per game
- one FAQ block on home
- one small amount of unique text per game page
- clean metadata and canonical URLs

Do not generate dozens of weak pages before real traffic exists.

## 8. TikTok traffic architecture

TikTok users need ultra-fast first interaction.

Rules:

- route video clicks to one focused game page, not a generic directory
- keep top copy short and challenge-oriented
- start gameplay above the fold
- avoid consent or modal interruptions before first interaction unless legally required

## 9. Delivery roadmap

### Phase 1

- static shell
- three game prototypes
- local event queue
- basic leaderboard

### Phase 2

- edge APIs
- daily challenge
- country leaderboard
- result card sharing

### Phase 3

- automated game publishing pipeline
- A/B test of game cards and copy
- ad integration after retention signal exists
