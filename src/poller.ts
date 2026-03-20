import Parser from 'rss-parser';
import { EventEmitter } from 'events';
import { feedUrls } from './feeds';

const parser = new Parser();

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
    private pollingIntervalMs: number = 2000; // 2 seconds between batches
    private batchSize: number = 2; // Fetch 2 feeds at a time
    private isPolling: boolean = false;
    private currentBatchIndex: number = 0;

    constructor() {
        super();
        console.log(`[Poller] Initialized with ${this.urls.length} feeds.`);
    }

    public start() {
        if (this.isPolling) return;
        this.isPolling = true;
        
        // Initial shuffle
        this.urls = [...this.urls].sort(() => Math.random() - 0.5);
        this.nextBatch();
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
        setTimeout(() => this.nextBatch(), this.pollingIntervalMs);
    }

    private async fetchFeed(url: string) {
        try {
            const feed = await parser.parseURL(url);
            const sourceName = feed.title || new URL(url).hostname;

            feed.items.forEach(item => {
                if (!item.link || !item.title) return;

                // Deduplication
                if (this.processedUrls.has(item.link)) return;

                // Add to processed set
                this.processedUrls.add(item.link);
                
                // Keep set size manageable
                if (this.processedUrls.size > 10000) {
                    const iterator = this.processedUrls.values();
                    for(let j=0; j<1000; j++) {
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
        } catch (error) {
            // Silently fail for individual feed errors, just log simplified
            // console.error(`[Poller] Error fetching ${url}:`, error.message);
        }
    }
}
