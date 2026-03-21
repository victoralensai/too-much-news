import { FeedCircuitBreaker } from '../src/circuit-breaker';

describe('FeedCircuitBreaker', () => {
    test('allows request when no failure recorded', () => {
        const cb = new FeedCircuitBreaker(1000, 10000);
        expect(cb.canRequest('https://feed.test')).toBe(true);
    });

    test('blocks after failure and unblocks after backoff', () => {
        const cb = new FeedCircuitBreaker(1000, 10000);
        const now = 10000;
        const url = 'https://feed.test';

        cb.recordFailure(url, now);

        expect(cb.canRequest(url, now + 500)).toBe(false);
        expect(cb.canRequest(url, now + 1000)).toBe(true);
    });

    test('backs off exponentially and caps max', () => {
        const cb = new FeedCircuitBreaker(1000, 4000);
        const url = 'https://feed.test';
        const now = 20000;

        cb.recordFailure(url, now);
        expect(cb.getState(url)?.nextAllowedAt).toBe(now + 1000);

        cb.recordFailure(url, now);
        expect(cb.getState(url)?.nextAllowedAt).toBe(now + 2000);

        cb.recordFailure(url, now);
        expect(cb.getState(url)?.nextAllowedAt).toBe(now + 4000);

        cb.recordFailure(url, now);
        expect(cb.getState(url)?.nextAllowedAt).toBe(now + 4000);
    });

    test('resets state on success', () => {
        const cb = new FeedCircuitBreaker(1000, 10000);
        const url = 'https://feed.test';

        cb.recordFailure(url, 0);
        expect(cb.getState(url)).toBeDefined();

        cb.recordSuccess(url);
        expect(cb.getState(url)).toBeUndefined();
        expect(cb.canRequest(url, 1)).toBe(true);
    });
});
