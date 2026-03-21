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
- `newestArticleAgeMs`

UI behavior:

- `BUFFER` shows a slightly fuzzed value (about +/-5%) for the first 5 seconds after page load, then switches to the exact queue size.
- `SIGNAL` shows `Newest: ... ago` while buffered items exist.
- `SIGNAL` switches to `🔴 Real-time` when the client queue is empty.

## Testing

Current tests cover:

- Archive validation/parsing
- Environment config parsing
- Server utility logic
- Feed circuit breaker behavior

Run with:

`npm test`

## CI/CD

GitHub Actions workflow: `.github/workflows/cicd.yml`

Pipeline behavior:

- On pull requests to `main`: run CI (`npm ci`, `npm run build`, `npm test`)
- On pushes to `main`: run CI, then publish Docker image to GHCR
- On version tags (`v*`): run CI, then publish Docker image with tag metadata

Published image:

- Registry: `ghcr.io/victoralensai/too-much-news`
- Tags include commit SHA, branch/tag refs, and `latest` on default branch

## Deployment

### Run with Docker (local)

Build:

`docker build -t too-much-news:local .`

Run:

`docker run --rm -p 3000:3000 --env-file .env too-much-news:local`

### Run published image (GHCR)

`docker run --rm -p 3000:3000 ghcr.io/victoralensai/too-much-news:latest`

Optional persistent archive mount:

`docker run --rm -p 3000:3000 -v $(pwd)/archive.json:/app/archive.json ghcr.io/victoralensai/too-much-news:latest`

For full self-hosted instructions with Docker Compose and update workflow, see `DEPLOYMENT.md`.

## Project Notes

- Runtime archive state file (`archive.json`) is ignored by git.
- `AGENT.md` documents architecture, hardening choices, and follow-up recommendations.

## License

MIT (see `LICENSE`).
