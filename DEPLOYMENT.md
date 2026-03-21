# Self-Hosted Deployment

This project publishes a Docker image automatically to GitHub Container Registry (GHCR) via GitHub Actions.

- Image: `ghcr.io/victoralensai/too-much-news:latest`
- CI/CD workflow: `.github/workflows/cicd.yml`

## Prerequisites

- A Linux server with Docker and Docker Compose plugin installed
- Ports open to your target audience (at least `3000`, or reverse proxy via `80/443`)
- Access to this repository

## 1) Prepare server files

On your server, create a deployment folder and copy these files from the repo:

- `docker-compose.prod.yml`
- `.env.example` (rename to `.env`)

Example:

```bash
mkdir -p ~/too-much-news
cd ~/too-much-news
# copy files here, then:
cp .env.example .env
```

## 2) (Optional) Authenticate to GHCR

If the image/package is private, login first:

```bash
echo "<GITHUB_TOKEN>" | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
```

If the package is public, no login is required.

## 3) Start the service

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Verify:

```bash
docker compose -f docker-compose.prod.yml ps
curl -sS http://localhost:3000/health
```

## 4) Update to latest release

When new code lands on `main`, GitHub Actions builds/tests, then publishes a new image.

To deploy latest on your server:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## 5) Persistence

Archive data is persisted via Docker volume `too-much-news-data` at `/app/data` in container.

- Active file path: `/app/data/archive.json`
- Set by: `ARCHIVE_FILE_PATH=/app/data/archive.json`

## 6) Logs and operations

```bash
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml down
```

## Notes

- GitHub Pages cannot host this app end-to-end because Pages is static-only.
- This app needs a live Node.js backend for Socket.IO and feed polling.
