import { NewsItem } from './poller';

export interface HealthPayload {
    status: 'ok';
    uptimeSeconds: number;
    archiveSize: number;
    pendingQueueSize: number;
    timestamp: string;
}

export function createHealthPayload(
    archiveSize: number,
    pendingQueueSize: number,
    uptimeSeconds: number,
    timestamp = new Date().toISOString()
): HealthPayload {
    return {
        status: 'ok',
        uptimeSeconds,
        archiveSize,
        pendingQueueSize,
        timestamp
    };
}

export function getNextBroadcastDelay(minMs: number, maxMs: number): number {
    const safeMin = Math.max(minMs, 1);
    const safeMax = Math.max(maxMs, safeMin);
    const spread = safeMax - safeMin;
    return Math.random() * spread + safeMin;
}

export function trimArchive(items: NewsItem[], limit: number): NewsItem[] {
    if (limit <= 0) {
        return [];
    }
    return items.slice(-limit);
}
