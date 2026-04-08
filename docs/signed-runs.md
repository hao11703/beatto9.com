# Signed Runs

The project now supports a first MVP version of signed gameplay runs.

## Flow

1. The client creates a local session id.
2. The client calls `POST /api/session/start`.
3. The server returns a short-lived signed token tied to:
   - `gameId`
   - `anonymousUserId`
   - `sessionId`
   - `issuedAt`
   - `expiresAt`
4. The client includes that token when submitting leaderboard results.
5. The server verifies the token before accepting the score.

## Why this helps

This does not make cheating impossible, but it blocks the easiest form of direct leaderboard spam:

- arbitrary leaderboard POSTs with made-up users
- reusing score payloads without a matching started run
- stale run submissions after token expiry

## Current limitations

- the server still trusts the client for the actual score values
- a valid client session can still submit fake but plausible numbers
- no replay protection yet beyond token expiry and improvement-only writes

## Recommended next step

Add a dedicated `/api/session/finish` record and compare:

- level progression
- event counts
- completion time

before accepting a leaderboard update.
