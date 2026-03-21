import Parser from 'rss-parser';
import { EventEmitter } from 'events';
import { feedUrls } from './feeds';
import { readPositiveIntEnv } from './config';
import { FeedCircuitBreaker } from './circuit-breaker';

const DEFAULT_POLL_INTERVAL_MS = 4000;
const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_FEED_TIMEOUT_MS = 10000;
const DEFAULT_FEED_BACKOFF_MIN_MS = 30000;
const DEFAULT_FEED_BACKOFF_MAX_MS = 600000;
const MAX_PROCESSED_URLS = 10000;
const PROCESSED_URLS_PRUNE_SIZE = 1000;

export interface NewsItem {
    title: string;
    link: string;
    source: string;
    pubDate?: string;
    content?: string;
    feedTitle?: string;
}

export class NewsPoller extends EventEmitter {
    private processedUrls: Set<string> = new Set();
    private urls: string[] = feedUrls;
    private pollingIntervalMs: number;
    private batchSize: number;
    private feedTimeoutMs: number;
    private isPolling: boolean = false;
    private currentBatchIndex: number = 0;
    private nextBatchTimeout: NodeJS.Timeout | null = null;
    private circuitBreaker: FeedCircuitBreaker;

    constructor() {
        super();
        this.pollingIntervalMs = readPositiveIntEnv('POLL_INTERVAL_MS', DEFAULT_POLL_INTERVAL_MS);
        this.batchSize = readPositiveIntEnv('POLL_BATCH_SIZE', DEFAULT_BATCH_SIZE);
        this.feedTimeoutMs = readPositiveIntEnv('FEED_TIMEOUT_MS', DEFAULT_FEED_TIMEOUT_MS);
        const minBackoff = readPositiveIntEnv('FEED_BACKOFF_MIN_MS', DEFAULT_FEED_BACKOFF_MIN_MS);
        const maxBackoff = readPositiveIntEnv('FEED_BACKOFF_MAX_MS', DEFAULT_FEED_BACKOFF_MAX_MS);
        this.circuitBreaker = new FeedCircuitBreaker(minBackoff, maxBackoff);
        console.log(`[Poller] Initialized with ${this.urls.length} feeds.`);
    }

    public start() {
        if (this.isPolling) return;
        this.isPolling = true;
        
        // Initial shuffle
        this.urls = [...this.urls].sort(() => Math.random() - 0.5);
        this.nextBatch();
    }

    public stop() {
        this.isPolling = false;
        if (this.nextBatchTimeout) {
            clearTimeout(this.nextBatchTimeout);
            this.nextBatchTimeout = null;
        }
    }

    private async nextBatch() {
        if (!this.isPolling) return;

        // Wrap around if we reached the end
        if (this.currentBatchIndex >= this.urls.length) {
            this.currentBatchIndex = 0;
            // Reshuffle for variety
            this.urls = [...this.urls].sort(() => Math.random() - 0.5);
            console.log('[Poller] Cycle complete. Reshuffling and continuing...');
        }

        const batch = this.urls.slice(this.currentBatchIndex, this.currentBatchIndex + this.batchSize);
        this.currentBatchIndex += this.batchSize;

        // Process batch
        await Promise.allSettled(batch.map(url => this.fetchFeed(url)));

        // Schedule next batch
        this.nextBatchTimeout = setTimeout(() => this.nextBatch(), this.pollingIntervalMs);
    }

    private async fetchFeed(url: string) {
        if (!this.circuitBreaker.canRequest(url)) {
            return;
        }

        try {
            // Enhanced headers to look more like a real user
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.google.com/'
            };

            // Special case for Reddit (requires specific format)
            if (url.includes('reddit.com')) {
                headers['User-Agent'] = 'web:too-much-news:v1.0 (by /u/victor_jean)';
            }

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Feed timeout after ${this.feedTimeoutMs}ms`)), this.feedTimeoutMs)
            );

            // Create a temporary parser for this request to use custom headers
            // rss-parser documentation suggests passing headers in the constructor or options
            const localParser = new Parser({ headers });

            const feed = await Promise.race([
                localParser.parseURL(url),
                timeoutPromise
            ]) as Parser.Output<Record<string, unknown>>;

            const sourceName = feed.title || new URL(url).hostname;

            feed.items.forEach((item) => {
                if (!item.link || !item.title) return;

                // Deduplication
                if (this.processedUrls.has(item.link)) return;

                // Add to processed set
                this.processedUrls.add(item.link);
                
                // Keep set size manageable
                if (this.processedUrls.size > MAX_PROCESSED_URLS) {
                    const iterator = this.processedUrls.values();
                    for (let j = 0; j < PROCESSED_URLS_PRUNE_SIZE; j++) {
                        const nextVal = iterator.next().value;
                        if (nextVal) this.processedUrls.delete(nextVal);
                    }
                }

                const newsItem: NewsItem = {
                    title: item.title,
                    link: item.link,
                    source: sourceName,
                    pubDate: item.pubDate,
                    content: item.contentSnippet || item.content,
                    feedTitle: feed.title
                };

                this.emit('news', newsItem);
            });

            this.circuitBreaker.recordSuccess(url);
        } catch (error: any) {
            this.circuitBreaker.recordFailure(url);
            // More descriptive logging for 24/7 service stability
            console.error(`[Poller] Failed to fetch ${url}: ${error.message}`);
        }
    }
}
