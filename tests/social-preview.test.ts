import {
    ONE_MINUTE_MS,
    buildFallbackOverlaySvg,
    buildSocialOverlaySvg,
    escapeXml,
    generateFallbackSocialImagePng,
    generateSocialImagePng,
    SOCIAL_IMAGE_FONT_FAMILY,
    pruneRecentHeadlineTimestamps
} from '../src/social-preview';

describe('social preview utils', () => {
    test('prunes timestamps older than one minute', () => {
        const now = 1_000_000;
        const timestamps = [
            now - ONE_MINUTE_MS - 1,
            now - ONE_MINUTE_MS,
            now - 1000,
            now
        ];

        expect(pruneRecentHeadlineTimestamps(timestamps, now)).toEqual([
            now - ONE_MINUTE_MS,
            now - 1000,
            now
        ]);
    });

    test('escapes XML control characters', () => {
        const input = `5 < 7 & "quotes" and 'apostrophes'`;
        expect(escapeXml(input)).toBe('5 &lt; 7 &amp; &quot;quotes&quot; and &apos;apostrophes&apos;');
    });

    test('builds SVG with escaped text and count', () => {
        const svg = buildSocialOverlaySvg(1234, 'a < b & c');
        expect(svg).toContain('YOU MISSED 1,234 HEADLINES');
        expect(svg).toContain('IN THE LAST MINUTE');
        expect(svg).toContain('a &lt; b &amp; c');
        expect(svg).toContain(`font-family="${SOCIAL_IMAGE_FONT_FAMILY}"`);
    });

    test('generates PNG buffer', async () => {
        const png = await generateSocialImagePng(42, 'desc');
        expect(Buffer.isBuffer(png)).toBe(true);
        expect(png.length).toBeGreaterThan(1000);
    });

    test('builds fallback SVG with static warning text', () => {
        const svg = buildFallbackOverlaySvg();
        expect(svg).toContain('YOU ARE MISSING ON WHATS');
        expect(svg).toContain('HAPPENING RIGHT NOW');
        expect(svg).toContain(`font-family="${SOCIAL_IMAGE_FONT_FAMILY}"`);
    });

    test('generates fallback PNG buffer', async () => {
        const png = await generateFallbackSocialImagePng();
        expect(Buffer.isBuffer(png)).toBe(true);
        expect(png.length).toBeGreaterThan(1000);
    });
});
