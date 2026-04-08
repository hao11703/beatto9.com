# Deployment Guide

## Recommended first production setup

Use Cloudflare Pages for the static site and Pages Functions for the API layer.

This project is already structured for that model:

- static assets at the repository root
- API handlers under `functions/`
- security headers in `_headers`
- sitemap and robots included

## 1. What to prepare

- your domain: `beatto9.com`
- Cloudflare account
- Pages project
- optional D1 database for leaderboards and event batching
- KV namespace for rate limiting
- a strong `SESSION_SECRET`

## 2. Create a Pages project

Point the Pages project at this repository.

Suggested settings:

- Framework preset: None
- Build command: none
- Build output directory: `.`

## 3. Connect the domain

In Cloudflare Pages:

- attach `beatto9.com`
- enable HTTPS
- redirect `www` to apex or the reverse, but keep only one canonical domain

## 4. Functions routing

These routes are expected:

- `/api/event`
- `/api/leaderboard`
- `/api/leaderboard/submit`

The repository already contains starter handlers for those routes.

Also configure:

- `DB` for D1
- `RATE_LIMITS` for KV-based rate limiting
- `SESSION_SECRET` for signed run tokens

## 5. Production data path

Current repository state:

- event ingestion: D1-ready handler with stub fallback
- leaderboard reads: D1-ready handler with stub fallback
- leaderboard submit: D1-ready handler with stub fallback

Recommended upgrade path:

1. Create the D1 database and apply `db/schema.sql`.
2. Bind the D1 database in Pages or Wrangler.
3. Add stronger validation and rate limiting.
4. Keep client-side local fallback enabled.

## 6. Performance checklist before launch

- keep pages static
- avoid adding third-party scripts on first paint
- keep game modules isolated
- compress images before upload
- do not add custom web fonts unless metrics justify them

## 7. Legal checklist before launch

- replace placeholder contact details in privacy and terms
- decide cookie/consent strategy before enabling ad tech in regulated markets
- add business identity details if required by your monetization stack

## 8. Abuse protection checklist

- bind a KV namespace as `RATE_LIMITS`
- keep D1 bound as `DB`
- review `docs/anti-abuse.md`
- add stronger signed-run validation before treating leaderboards as highly competitive
