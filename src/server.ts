import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { NewsPoller, NewsItem } from './poller';
import { readPositiveIntEnv } from './config';
import { isNewsItemArray, parseArchiveJson } from './archive';
import { createHealthPayload, getNextBroadcastDelay, trimArchive } from './server-utils';
import { generateSocialImagePng, pruneRecentHeadlineTimestamps } from './social-preview';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);
const PORT = readPositiveIntEnv('PORT', 3000);
const ARCHIVE_FILE = process.env.ARCHIVE_FILE_PATH || path.join(__dirname, '../archive.json');
const ARCHIVE_LIMIT = readPositiveIntEnv('ARCHIVE_LIMIT', 2000);
const HISTORY_SYNC_LIMIT = readPositiveIntEnv('HISTORY_SYNC_LIMIT', 2500);
const ARCHIVE_SAVE_INTERVAL_MS = readPositiveIntEnv('ARCHIVE_SAVE_INTERVAL_MS', 300000);
const BROADCAST_DELAY_MIN_MS = readPositiveIntEnv('BROADCAST_DELAY_MIN_MS', 300);
const BROADCAST_DELAY_MAX_MS = readPositiveIntEnv('BROADCAST_DELAY_MAX_MS', 1500);
const SOCIAL_IMAGE_CACHE_MS = 30000;
const SOCIAL_DESCRIPTION = 'finally become up to date with whats happening in the world!';

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (_req, res) => {
    const newestArticleAgeMs =
        newestArticleTimestampMs === null ? null : Math.max(0, Date.now() - newestArticleTimestampMs);

    res.status(200).json(
        createHealthPayload(
            newsArchive.length,
            pendingNews.length,
            Math.floor(process.uptime()),
            newestArticleAgeMs
        )
    );
});

app.get('/og-image', async (_req, res) => {
    try {
        const now = Date.now();
        if (cachedOgImagePng && now - cachedOgImageGeneratedAtMs < SOCIAL_IMAGE_CACHE_MS) {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', `public, max-age=${Math.floor(SOCIAL_IMAGE_CACHE_MS / 1000)}`);
            res.status(200).send(cachedOgImagePng);
            return;
        }

        recentHeadlineTimestampsMs = pruneRecentHeadlineTimestamps(recentHeadlineTimestampsMs, now);
        const recentHeadlineCount = recentHeadlineTimestampsMs.length;
        const imageBuffer = await generateSocialImagePng(recentHeadlineCount, SOCIAL_DESCRIPTION);

        cachedOgImagePng = imageBuffer;
        cachedOgImageGeneratedAtMs = now;

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', `public, max-age=${Math.floor(SOCIAL_IMAGE_CACHE_MS / 1000)}`);
        res.status(200).send(imageBuffer);
    } catch (error) {
        console.error('[Social] Failed to generate OG image:', error);
        res.sendFile(path.join(__dirname, '../public/og-fallback.svg'));
    }
});

// Initialize Poller
const poller = new NewsPoller();

// In-memory archive (Ring Buffer) for new clients and steady broadcast
let newsArchive: NewsItem[] = [];
let newestArticleTimestampMs: number | null = null;
let recentHeadlineTimestampsMs: number[] = [];
let cachedOgImagePng: Buffer | null = null;
let cachedOgImageGeneratedAtMs = 0;

// Load archive from file if exists to survive restarts
try {
    if (fs.existsSync(ARCHIVE_FILE)) {
        const data = fs.readFileSync(ARCHIVE_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (isNewsItemArray(parsed)) {
            newsArchive = parseArchiveJson(data, ARCHIVE_LIMIT);
            const newestLoaded = newsArchive[newsArchive.length - 1];
            const parsedPubDate = newestLoaded?.pubDate ? Date.parse(newestLoaded.pubDate) : Number.NaN;
            if (!Number.isNaN(parsedPubDate)) {
                newestArticleTimestampMs = parsedPubDate;
            } else if (newsArchive.length > 0) {
                newestArticleTimestampMs = Date.now();
            }
        } else {
            console.warn('[Archive] Existing archive has invalid format. Starting with empty archive.');
        }
        console.log(`[Archive] Loaded ${newsArchive.length} items from disk.`);
    }
} catch (err) {
    console.error('[Archive] Failed to load archive:', err);
}

// Queue for "fresh" news that hasn't been broadcasted yet
let pendingNews: NewsItem[] = [];

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Status message
    socket.emit('status', { message: 'CONNECTED: SYNCING FIREHOSE HISTORY...' });

    // Send a burst of history to fill the client buffer instantly
    const initialHistory = newsArchive.slice(-HISTORY_SYNC_LIMIT);
    initialHistory.forEach(item => {
        socket.emit('news-item', item);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Capture news from poller and store in queues
poller.on('news', (item: NewsItem) => {
    const now = Date.now();
    pendingNews.push(item);
    
    // Add to archive (deduplicate link check could go here too, but poller handles it)
    newsArchive.push(item);
    newsArchive = trimArchive(newsArchive, ARCHIVE_LIMIT);
    newestArticleTimestampMs = now;
    recentHeadlineTimestampsMs.push(now);
    recentHeadlineTimestampsMs = pruneRecentHeadlineTimestamps(recentHeadlineTimestampsMs, now);
    cachedOgImagePng = null;

    // Save immediately if this is the first item ever to ensure file creation
    if (newsArchive.length === 1) {
        saveArchive();
    }
});

function saveArchive() {
    try {
        const tmpFile = `${ARCHIVE_FILE}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(newsArchive), 'utf8');
        fs.renameSync(tmpFile, ARCHIVE_FILE);
        // console.log('[Archive] Saved to disk.');
    } catch (err) {
        console.error('[Archive] Failed to save archive:', err);
    }
}

// Save archive periodically (every 5 minutes)
const archiveInterval = setInterval(saveArchive, ARCHIVE_SAVE_INTERVAL_MS);

// STEADY BROADCASTER LOOP: Guarantees the firehose never stops
function broadcastNext() {
    let itemToBroadcast: NewsItem | null = null;

    if (pendingNews.length > 0) {
        // Favor fresh news if available
        itemToBroadcast = pendingNews.shift() || null;
    } else if (newsArchive.length > 0) {
        // Replay a random historical item if no fresh news is available
        const randomIndex = Math.floor(Math.random() * newsArchive.length);
        itemToBroadcast = newsArchive[randomIndex];
    }

    if (itemToBroadcast) {
        io.emit('news-item', itemToBroadcast);
    }

    const nextDelay = getNextBroadcastDelay(BROADCAST_DELAY_MIN_MS, BROADCAST_DELAY_MAX_MS);
    setTimeout(broadcastNext, nextDelay);
}

// Start fetching and the steady-state broadcaster
poller.start();
broadcastNext();

function shutdown(signal: string) {
    console.log(`[Server] Received ${signal}. Shutting down...`);
    clearInterval(archiveInterval);
    poller.stop();
    saveArchive();

    io.close(() => {
        try {
            server.close((err) => {
                const knownErr = err as NodeJS.ErrnoException | undefined;
                if (knownErr && knownErr.code === 'ERR_SERVER_NOT_RUNNING') {
                    console.debug('[Server] Server already closed during shutdown.');
                    console.log('[Server] Shutdown complete.');
                    process.exit(0);
                    return;
                }

                if (knownErr) {
                    console.error('[Server] Error during shutdown:', knownErr);
                    process.exit(1);
                    return;
                }

                console.log('[Server] Shutdown complete.');
                process.exit(0);
            });
        } catch (error) {
            const knownErr = error as NodeJS.ErrnoException;
            if (knownErr.code === 'ERR_SERVER_NOT_RUNNING') {
                console.debug('[Server] Server already closed during shutdown.');
                console.log('[Server] Shutdown complete.');
                process.exit(0);
                return;
            }

            console.error('[Server] Error during shutdown:', knownErr);
            process.exit(1);
        }
    });

    setTimeout(() => {
        console.error('[Server] Forced shutdown timeout reached.');
        process.exit(1);
    }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
