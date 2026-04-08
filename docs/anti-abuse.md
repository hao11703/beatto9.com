# Anti-Abuse Notes

This project now includes a lightweight MVP anti-abuse layer.

## Current protections

### Rate limiting

If Cloudflare KV is bound as `RATE_LIMITS`, the API applies simple IP-based limits:

- event ingestion: 120 requests per minute
- leaderboard reads: 120 requests per minute
- leaderboard submit: 20 requests per minute

### Input validation

- only known `gameId` values are accepted
- anonymous user ids and session ids must match expected formats
- leaderboard levels must stay within `0-9`
- implausible times and attempt counts are rejected
- event batches are capped at 50 items

### Update rules

- leaderboard rows only update when a run improves the previous record
- display names are trimmed and normalized

## Remaining risks

This is good enough for early public testing, but not enough for strong competitive integrity.

Still missing:

- server-side score reconstruction
- stronger country or ASN based throttling
- anomaly dashboards and moderation tools
- replay protection for already-used run tokens

## Recommended next hardening step

Before meaningful traffic, add `/api/session/finish` verification and compare the submitted result
against recorded run data before accepting the leaderboard update.
