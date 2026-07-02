import { Platform } from 'react-native';

export interface BrandColors {
    primaryColor: string;
    secondaryColor: string;
}

function rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join('')}`;
}

function colorDistance(
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number },
): number {
    return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function bucketKey(r: number, g: number, b: number, step = 24): string {
    const br = Math.min(255, Math.round(r / step) * step);
    const bg = Math.min(255, Math.round(g / step) * step);
    const bb = Math.min(255, Math.round(b / step) * step);
    return `${br},${bg},${bb}`;
}

export function extractBrandColorsFromPixels(pixels: Uint8ClampedArray): BrandColors {
    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

    for (let index = 0; index < pixels.length; index += 4) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const a = pixels[index + 3];

        if (a < 128) continue;
        if (r > 245 && g > 245 && b > 245) continue;
        if (r < 20 && g < 20 && b < 20) continue;

        const key = bucketKey(r, g, b);
        const existing = buckets.get(key);
        if (existing) {
            existing.count++;
        } else {
            buckets.set(key, { count: 1, r, g, b });
        }
    }

    const sorted = [...buckets.values()].sort((left, right) => right.count - left.count);
    const primaryEntry = sorted[0] ?? { r: 136, g: 136, b: 136, count: 0 };
    const secondaryEntry =
        sorted.find((entry, index) => index > 0 && colorDistance(entry, primaryEntry) > 60) ??
        sorted[1] ??
        primaryEntry;

    return {
        primaryColor: rgbToHex(primaryEntry.r, primaryEntry.g, primaryEntry.b),
        secondaryColor: rgbToHex(secondaryEntry.r, secondaryEntry.g, secondaryEntry.b),
    };
}

async function extractBrandColorsOnWeb(uri: string): Promise<BrandColors> {
    if (typeof document === 'undefined') {
        throw new Error('Color extraction is unavailable.');
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = document.createElement('img');
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Could not load image for color extraction.'));
        el.src = uri;
    });

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not analyze image colors.');

    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    return extractBrandColorsFromPixels(data);
}

export async function extractBrandColorsFromUri(uri: string): Promise<BrandColors | null> {
    if (Platform.OS !== 'web') return null;
    return extractBrandColorsOnWeb(uri);
}
