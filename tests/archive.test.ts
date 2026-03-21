import { isNewsItem, isNewsItemArray, parseArchiveJson } from '../src/archive';

describe('archive parsing', () => {
    test('accepts a valid news item', () => {
        expect(
            isNewsItem({
                title: 'Title',
                link: 'https://example.com',
                source: 'Example'
            })
        ).toBe(true);
    });

    test('rejects invalid news item', () => {
        expect(isNewsItem({ title: 'Only title' })).toBe(false);
    });

    test('accepts valid news array', () => {
        expect(
            isNewsItemArray([
                { title: 'a', link: 'https://a.com', source: 'A' },
                { title: 'b', link: 'https://b.com', source: 'B' }
            ])
        ).toBe(true);
    });

    test('returns empty when archive json shape is invalid', () => {
        const raw = JSON.stringify([{ nope: true }]);
        expect(parseArchiveJson(raw, 10)).toEqual([]);
    });

    test('applies limit to parsed archive', () => {
        const raw = JSON.stringify([
            { title: '1', link: 'https://1.com', source: 'S' },
            { title: '2', link: 'https://2.com', source: 'S' },
            { title: '3', link: 'https://3.com', source: 'S' }
        ]);

        const result = parseArchiveJson(raw, 2);
        expect(result).toHaveLength(2);
        expect(result[0].title).toBe('2');
        expect(result[1].title).toBe('3');
    });
});
