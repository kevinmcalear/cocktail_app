// Shared by the link preview images (api/menu-og.ts, api/drink-og.ts): satori
// elements without JSX, Google fonts, photos as data URIs and the plain glass.
// Relative imports only: these run on Vercel, outside the app's bundle.

import { SKETCH } from '../constants/sketch';
import { thumbUrl } from './thumbnails';

const PENCIL = SKETCH.graphite;

export type Style = Record<string, string | number>;
export interface El {
  type: string;
  props: { style?: Style; src?: string; width?: number; height?: number; children?: (El | string)[] | El | string };
}
// Satori takes React-shaped elements; plain objects keep this file free of JSX.
export const h = (type: string, style: Style, ...children: (El | string | null | false)[]): El => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.filter((c): c is El | string => !!c) },
});
/** A picture: a photo fills its tile with rounded corners, as in the app; a drawing sits on the paper. */
export interface Picture {
  src: string;
  kind: 'photo' | 'sketch' | 'glass';
}
export const img = ({ src, kind }: Picture, size: number): El => ({
  type: 'img',
  props: { src, width: size, height: size, style: kind === 'photo' ? { objectFit: 'cover', borderRadius: 22 } : { objectFit: 'contain' } },
});

/** A Google font, only the glyphs `text` needs, as satori wants it (TTF). */
export async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
  const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!src) throw new Error(`No ${family} font`);
  return (await fetch(src)).arrayBuffer();
}

const base64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** A photo as a data URI: the 480 px copy, then the original. Null if neither loads. */
export async function photo(url: string): Promise<string | null> {
  for (const u of [thumbUrl(url), url]) {
    if (!u) continue;
    try {
      const res = await fetch(u);
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.startsWith('image/')) return `data:${type};base64,${base64(new Uint8Array(await res.arrayBuffer()))}`;
    } catch {
      // Try the next one.
    }
  }
  return null;
}

// A plain glass outline, for a drink that isn't public (or has no drawing yet).
export const GLASS = `data:image/svg+xml;base64,${btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="30" viewBox="0 0 26 30"><path d="M3 4 H23 L13 15 Z M13 15 V26 M8 26 H18" fill="none" stroke="${PENCIL}" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
)}`;

