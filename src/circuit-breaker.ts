export interface FeedFailureState {
    failures: number;
    nextAllowedAt: number;
}

export class FeedCircuitBreaker {
    private readonly states = new Map<string, FeedFailureState>();
    private readonly minBackoffMs: number;
    private readonly maxBackoffMs: number;

    constructor(minBackoffMs = 30000, maxBackoffMs = 600000) {
        this.minBackoffMs = minBackoffMs;
        this.maxBackoffMs = maxBackoffMs;
    }

    public canRequest(url: string, now = Date.now()): boolean {
        const state = this.states.get(url);
        if (!state) {
            return true;
        }

        return now >= state.nextAllowedAt;
    }

    public recordSuccess(url: string): void {
        this.states.delete(url);
    }

    public recordFailure(url: string, now = Date.now()): void {
        const current = this.states.get(url) || { failures: 0, nextAllowedAt: 0 };
        const failures = current.failures + 1;
        const expBackoff = this.minBackoffMs * Math.pow(2, failures - 1);
        const backoff = Math.min(expBackoff, this.maxBackoffMs);

        this.states.set(url, {
            failures,
            nextAllowedAt: now + backoff
        });
    }

    public getState(url: string): FeedFailureState | undefined {
        const state = this.states.get(url);
        if (!state) {
            return undefined;
        }
        return { ...state };
    }
}
