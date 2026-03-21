import { createHealthPayload, getNextBroadcastDelay, trimArchive } from '../src/server-utils';
import { NewsItem } from '../src/poller';

describe('server utils', () => {
    test('creates health payload with expected shape', () => {
        const payload = createHealthPayload(10, 4, 123, 2500, '2026-01-01T00:00:00.000Z');

        expect(payload).toEqual({
            status: 'ok',
            archiveSize: 10,
            pendingQueueSize: 4,
            uptimeSeconds: 123,
            newestArticleAgeMs: 2500,
            timestamp: '2026-01-01T00:00:00.000Z'
        });
    });

    test('broadcast delay stays within min/max bounds', () => {
        for (let i = 0; i < 200; i++) {
            const delay = getNextBroadcastDelay(300, 1500);
            expect(delay).toBeGreaterThanOrEqual(300);
            expect(delay).toBeLessThanOrEqual(1500);
        }
    });

    test('trimArchive keeps newest entries', () => {
        const items: NewsItem[] = [
            { title: '1', link: 'https://1.com', source: 'S' },
            { title: '2', link: 'https://2.com', source: 'S' },
            { title: '3', link: 'https://3.com', source: 'S' }
        ];

        const result = trimArchive(items, 2);
        expect(result).toHaveLength(2);
        expect(result[0].title).toBe('2');
        expect(result[1].title).toBe('3');
    });

    test('trimArchive returns empty for non-positive limit', () => {
        const items: NewsItem[] = [{ title: '1', link: 'https://1.com', source: 'S' }];
        expect(trimArchive(items, 0)).toEqual([]);
    });
});
