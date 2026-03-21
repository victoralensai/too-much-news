import sharp from 'sharp';

export const ONE_MINUTE_MS = 60000;
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;

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
    const primaryText = `YOU MISSED ${recentHeadlineCount.toLocaleString()} HEADLINES IN THE LAST MINUTE`;

    return `
        <svg width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" fill="#050505"/>
            <text x="100" y="180" fill="#f3f3f3" font-family="Courier New, monospace" font-size="82">📰</text>
            <text x="100" y="285" fill="#f3f3f3" font-family="Courier New, monospace" font-size="56">${escapeXml(
                primaryText
            )}</text>
            <text x="100" y="365" fill="#8ae68a" font-family="Courier New, monospace" font-size="34">${escapeXml(
                description
            )}</text>
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
