# AGENT

## Purpose
- This project is an intentionally overwhelming real-time news firehose.
- It prioritizes chaotic visual output over editorial filtering.

## Current Architecture
- `src/server.ts`: Express + Socket.IO server, archive persistence, broadcast loop, health endpoint.
- `src/poller.ts`: RSS polling engine, deduplication, per-feed timeout, environment-driven tuning.
- `src/feeds.ts`: static feed URL list.
- `public/client.js`: queue processing, rendering, connection state handling, ticker updates.
- `public/style.css`, `public/index.html`, `public/about.html`: presentation layer.

## Environment Knobs
- `PORT` (default: `3000`)
- `ARCHIVE_FILE_PATH` (default: `archive.json` in repo root)
- `ARCHIVE_LIMIT` (default: `2000`)
- `HISTORY_SYNC_LIMIT` (default: `500`)
- `ARCHIVE_SAVE_INTERVAL_MS` (default: `300000`)
- `BROADCAST_DELAY_MIN_MS` (default: `300`)
- `BROADCAST_DELAY_MAX_MS` (default: `1500`)
- `POLL_INTERVAL_MS` (default: `4000`)
- `POLL_BATCH_SIZE` (default: `1`)
- `FEED_TIMEOUT_MS` (default: `10000`)

## Hardening Added
- Archive load now validates shape before use.
- Archive writes are atomic (`.tmp` write + rename).
- Added `/health` endpoint with queue/archive telemetry.
- Added graceful shutdown handling (`SIGINT`, `SIGTERM`) with final archive flush.
- Poller now supports `stop()` and environment-based runtime tuning.
- Frontend now validates inbound items before enqueue.
- Frontend queue overflow now drops oldest items in bounded batches.
- Frontend connection state is explicit (`CONNECTED`, `RECONNECTING`, `DISCONNECTED`, `DEGRADED`).
- Frontend rendering moved away from `innerHTML` to safer DOM node creation.
- External links now use `noopener,noreferrer` and URL protocol checks.

## Remaining Risks / Next Improvements
- Add automated tests (poller behavior, archive validation, client queue invariants).
- Move feed list to config file with optional health score and backoff state.
- Add per-feed circuit breaker (temporary disable after repeated failures).
- Add lightweight structured logging and optional request IDs.
- Consider reducing animation intensity when `prefers-reduced-motion` is set.
- Add health/readiness split if deployed behind orchestration.

## Validation Checklist
- `npm run build` succeeds.
- `npm start` serves app and `/health`.
- Socket reconnect updates status text in UI.
- Queue never exceeds hard cap under sustained load.
- Archive recovers correctly after restart with existing file.
