import { NewsItem } from './poller';

export function isNewsItem(value: unknown): value is NewsItem {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const record = value as Record<string, unknown>;
    return (
        typeof record.title === 'string' &&
        typeof record.link === 'string' &&
        typeof record.source === 'string'
    );
}

export function isNewsItemArray(value: unknown): value is NewsItem[] {
    if (!Array.isArray(value)) {
        return false;
    }

    return value.every((item) => isNewsItem(item));
}

export function parseArchiveJson(raw: string, limit: number): NewsItem[] {
    const parsed = JSON.parse(raw);

    if (!isNewsItemArray(parsed)) {
        return [];
    }

    if (limit <= 0) {
        return [];
    }

    return parsed.slice(-limit);
}
