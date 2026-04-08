# BeatTo9

Performance-first web game site foundation for `beatto9.com`.

## Directory role

This folder is the real app root.

If you are working from the project root one level above, use its `package.json` scripts so you do not need to manually `cd h5` for common tasks.

## Why this stack

This project starts with a zero-dependency static shell on purpose:

- fastest possible first load
- no framework hydration cost
- easy deploy to Cloudflare Pages, Vercel, Netlify, or any CDN
- simple enough to validate the business before adding complexity

## Current scope

- lightweight landing page
- SEO-ready metadata
- privacy and terms pages
- three playable prototype games
- local-first leaderboard and analytics utilities
- architecture docs for analytics, leaderboard, and game delivery

## Recommended production architecture

- Frontend: static site served from global CDN
- Games: isolated vanilla JS modules loaded only when needed
- API: Supabase or Cloudflare-backed edge endpoints
- Analytics: first-party event ingestion
- Leaderboard: server-validated writes with rate limiting

## Deployment shape

- Static hosting: Cloudflare Pages
- Edge handlers: Pages Functions under `functions/`
- Local fallback: built in for analytics queue and leaderboards
- Database: D1 schema in `db/schema.sql`

## Local preview

You can open `index.html` directly in a browser, serve the folder with any static server, or use the project root scripts.

Example:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

From the project root:

```bash
npm run install:h5
npm run dev
```

## Next build steps

1. Replace stub APIs with Supabase or Cloudflare-backed production endpoints.
2. Add first-party analytics ingestion.
3. Upgrade leaderboards from local-first to remote validated writes.
4. Deploy the static shell behind Cloudflare.
