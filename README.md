# TOO MUCH NEWS!!

An overwhelming, real-time news firehose designed to visualize the sheer volume of global information.

Created by **Victor Jean** (vctor.me) as an artistic/humorous exploration of information overload.

## The Concept

Inspired by the feeling of adding too many RSS feeds to an aggregator and realizing you can never keep up. Instead of a useful tool, this project embraces chaos and turns global news volume into a live visual stream.

## Tech Stack

- **Backend:** Node.js, TypeScript, Express, Socket.IO
- **Polling:** `rss-parser` cycling through ~65 global sources
- **Frontend:** Vanilla JS + HTML/CSS (terminal/glitch style)
- **Testing:** Jest + ts-jest

## Features

- Real-time Socket.IO broadcast to connected clients
- Persistent archive (`archive.json`) to survive restarts
- Burst history sync for new clients
- Adaptive frontend queue processing to preserve responsiveness under load
- Health endpoint: `GET /health`
- Graceful shutdown (`SIGINT`, `SIGTERM`) with final archive flush
- Feed-level failure backoff (circuit breaker) with exponential retry delays
- Hardened rendering path (safer link handling, no `innerHTML` injection for news rows)

## Quick Start

1. Install dependencies: `npm install`
2. Copy env template: `cp .env.example .env`
3. Build: `npm run build`
4. Start: `npm start`
5. Open: `http://localhost:3000`

## Scripts

- `npm run dev` - run TypeScript server with nodemon
- `npm run build` - compile TypeScript to `dist/`
- `npm start` - run compiled server (`dist/server.js`)
- `npm test` - run test suite

## Configuration

All runtime knobs are documented in `.env.example`.

Key variables:

- `PORT`
- `ARCHIVE_FILE_PATH`
- `ARCHIVE_LIMIT`
- `HISTORY_SYNC_LIMIT`
- `ARCHIVE_SAVE_INTERVAL_MS`
- `BROADCAST_DELAY_MIN_MS`
- `BROADCAST_DELAY_MAX_MS`
- `POLL_INTERVAL_MS`
- `POLL_BATCH_SIZE`
- `FEED_TIMEOUT_MS`
- `FEED_BACKOFF_MIN_MS`
- `FEED_BACKOFF_MAX_MS`

## Health Check

Use the health endpoint for monitoring:

`GET /health`

Example response includes:

- `status`
- `uptimeSeconds`
- `archiveSize`
- `pendingQueueSize`
- `timestamp`

## Testing

Current tests cover:

- Archive validation/parsing
- Environment config parsing
- Server utility logic
- Feed circuit breaker behavior

Run with:

`npm test`

## Project Notes

- Runtime archive state file (`archive.json`) is ignored by git.
- `AGENT.md` documents architecture, hardening choices, and follow-up recommendations.

## License

MIT (see `LICENSE`).
