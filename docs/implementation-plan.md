# Implementation Plan

## Goal

Ship `beatto9.com` in layers without introducing unnecessary complexity.

## Stage 1: Foundation

Status: in progress

Deliverables:

- static landing page
- privacy page
- terms page
- architecture documentation
- baseline SEO files
- baseline security headers

Exit criteria:

- site can be deployed as static assets
- no framework dependency
- mobile-first layout works at common viewport sizes

## Stage 2: Core game shell

Deliverables:

- `/games/tap-sprint/`
- shared game shell module
- progress bar and retry loop
- local timer and attempt tracking
- lazy-loaded game bootstrap

Rules:

- one game per isolated JS module
- no shared heavyweight runtime
- no external assets required for first playable version

Exit criteria:

- first game page stays lightweight
- retry loop is instant
- session state survives brief tab switches where possible
- three prototype categories exist with shared client primitives

## Stage 3: First-party analytics

Deliverables:

- anonymous client id generation
- local event queue
- beacon-based write attempts
- event schema validation

Rules:

- analytics must never block gameplay
- if writes fail, queue and retry later
- event payloads remain compact

Exit criteria:

- can measure page view, game start, level fail, retry, level complete

## Stage 4: Leaderboards

Deliverables:

- leaderboard read endpoint
- leaderboard submit endpoint
- server-side validation
- basic rate limiting

Rules:

- impossible scores must be rejected
- scoreboard writes require a session signature
- reads should be cacheable

Exit criteria:

- top scores render on game pages
- suspicious submissions are logged
- local-first fallback remains usable if the API is unavailable

## Stage 5: Traffic-ready polish

Deliverables:

- TikTok-focused game pages
- metadata per game
- share result copy
- related games rail

Rules:

- the page must explain itself within the first screen
- the start button must be visible without scrolling on mobile

Exit criteria:

- one game page is ready for traffic testing

## Stage 6: Scale guardrails

Deliverables:

- daily challenge generation strategy
- publish checklist for new games
- score anomaly review process
- archive and retire rules for weak games

Exit criteria:

- adding a new game is a repeatable process, not a custom project
