# BeatTo9 H5 Guide

This directory is the active application root for BeatTo9.

## Scope

- static pages and landing experience
- game entry pages under `games/`
- shared JS and CSS under `src/`
- Cloudflare Pages Functions under `functions/`
- D1 schema and deployment config

## Editing Guidance

- Keep shared browser logic in `src/` instead of duplicating inline scripts across pages.
- When adding a new game, update both the game page and any landing-page references.
- Keep policy and SEO files consistent with the landing page and deployment routes.
- Review docs when changing architecture, deployment, or API behavior.

## Sensitive Config

- Do not commit real secrets into `wrangler.toml`.
- Prefer Cloudflare secrets or local-only `.dev.vars` during development.
