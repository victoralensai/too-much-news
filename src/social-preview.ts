import sharp from 'sharp';

export const ONE_MINUTE_MS = 60000;
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;
export const SOCIAL_IMAGE_FONT_FAMILY = 'Liberation Sans, Arial, sans-serif';

export function pruneRecentHeadlineTimestamps(timestampsMs: number[], nowMs: number): number[] {
    return timestampsMs.filter((timestampMs) => nowMs - timestampMs <= ONE_MINUTE_MS);
}

export function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function buildSocialOverlaySvg(recentHeadlineCount: number, description: string): string {
    const primaryLine = `YOU MISSED ${recentHeadlineCount.toLocaleString()} HEADLINES`;
    const secondaryLine = 'IN THE LAST MINUTE';

    return `
        <svg width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" fill="#050505"/>
            <text x="80" y="280" fill="#f3f3f3" font-family="${SOCIAL_IMAGE_FONT_FAMILY}" font-weight="700" font-size="56">${escapeXml(
                primaryLine
            )}</text>
            <text x="80" y="350" fill="#f3f3f3" font-family="${SOCIAL_IMAGE_FONT_FAMILY}" font-weight="700" font-size="50">${escapeXml(
                secondaryLine
            )}</text>
            <text x="80" y="430" fill="#8ae68a" font-family="${SOCIAL_IMAGE_FONT_FAMILY}" font-weight="600" font-size="34">${escapeXml(
                description
            )}</text>
        </svg>
    `;
}

export function buildFallbackOverlaySvg(): string {
    return `
        <svg width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" fill="#050505"/>
            <text x="80" y="300" fill="#f3f3f3" font-family="${SOCIAL_IMAGE_FONT_FAMILY}" font-weight="700" font-size="52">
                YOU ARE MISSING ON WHATS
            </text>
            <text x="80" y="370" fill="#f3f3f3" font-family="${SOCIAL_IMAGE_FONT_FAMILY}" font-weight="700" font-size="52">
                HAPPENING RIGHT NOW
            </text>
        </svg>
    `;
}

export async function generateSocialImagePng(recentHeadlineCount: number, description: string): Promise<Buffer> {
    const overlaySvg = buildSocialOverlaySvg(recentHeadlineCount, description);

    return sharp({
        create: {
            width: SOCIAL_IMAGE_WIDTH,
            height: SOCIAL_IMAGE_HEIGHT,
            channels: 3,
            background: '#050505'
        }
    })
        .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
        .png()
        .toBuffer();
}

export async function generateFallbackSocialImagePng(): Promise<Buffer> {
    const overlaySvg = buildFallbackOverlaySvg();

    return sharp({
        create: {
            width: SOCIAL_IMAGE_WIDTH,
            height: SOCIAL_IMAGE_HEIGHT,
            channels: 3,
            background: '#050505'
        }
    })
        .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
        .png()
        .toBuffer();
}
