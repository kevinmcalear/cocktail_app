// The link preview image for a shared home menu: /api/menu-og?id=<menu id>.
// The menu on paper, like its guest card: its night, its name, its drinks,
// who shared it, and up to four pictures (a drink's photo, or its own sketch
// drawn from its drawing inputs; a drink that isn't public is a plain glass,
// as on the shared page). middleware.ts points chat apps here.

import { ImageResponse } from '@vercel/og';

import { SKETCH } from '../constants/sketch';
import { drinksLine, fetchPreviewDrinks, fetchSharedMenu, fetchSketchInputs, isUuid, nightLabel, supabaseFromEnv, type PreviewDrink, type SharedMenuRow } from '../lib/menuPreview';
import { paintSketch } from '../lib/sketch/paint';
import { sceneToSvg } from '../lib/sketch/svg';
import type { SketchInputs } from '../lib/sketch/types';
import { thumbUrl } from '../lib/thumbnails';

export const config = { runtime: 'edge' };

const W = 1200;
const H = 630;
const INK = '#1A1714';
const MUTED = '#6B645B';
const PENCIL = SKETCH.graphite;

type Style = Record<string, string | number>;
interface El {
  type: string;
  props: { style?: Style; src?: string; width?: number; height?: number; children?: (El | string)[] | El | string };
}
// Satori takes React-shaped elements; plain objects keep this file free of JSX.
const h = (type: string, style: Style, ...children: (El | string | null | false)[]): El => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.filter((c): c is El | string => !!c) },
});
/** A picture: a photo fills its tile with rounded corners, as in the app; a drawing sits on the paper. */
interface Picture {
  src: string;
  kind: 'photo' | 'sketch' | 'glass';
}
const img = ({ src, kind }: Picture, size: number): El => ({
  type: 'img',
  props: { src, width: size, height: size, style: kind === 'photo' ? { objectFit: 'cover', borderRadius: 22 } : { objectFit: 'contain' } },
});

/** A Google font, only the glyphs `text` needs, as satori wants it (TTF). */
async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
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
async function photo(url: string): Promise<string | null> {
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
const GLASS = `data:image/svg+xml;base64,${btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="30" viewBox="0 0 26 30"><path d="M3 4 H23 L13 15 Z M13 15 V26 M8 26 H18" fill="none" stroke="${PENCIL}" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
)}`;

/** The first four drinks' pictures, in menu order. */
async function pictures(db: Parameters<typeof fetchPreviewDrinks>[0], menu: SharedMenuRow, drinks: PreviewDrink[]): Promise<Picture[]> {
  const slots = menu.sections.flatMap((s) => s.item_ids).slice(0, 4);
  const byId = new Map(drinks.map((d) => [d.id, d]));
  const drawn = slots.filter((id): id is string => !!id && !(byId.get(id)?.image_url && !byId.get(id)?.image_is_generated));
  const sketches = new Map((await fetchSketchInputs<SketchInputs>(db, drawn)).map((r) => [r.item_id, r.inputs]));
  const glass: Picture = { src: GLASS, kind: 'glass' };
  return Promise.all(
    slots.map(async (id): Promise<Picture> => {
      const d = id ? byId.get(id) : null;
      if (!id || !d) return glass;
      if (d.image_url && !d.image_is_generated) {
        const src = await photo(d.image_url);
        return src ? { src, kind: 'photo' } : glass;
      }
      const inputs = sketches.get(id);
      // Seeded with the drink's id, so it's the same drawing the app shows.
      return inputs ? { src: `data:image/svg+xml;base64,${btoa(sceneToSvg(paintSketch(inputs, { seed: id }), { size: 512 }))}`, kind: 'sketch' } : glass;
    }),
  );
}

function card(menu: SharedMenuRow, drinks: PreviewDrink[], pics: Picture[]): El {
  const night = nightLabel(menu.menu_date);
  const tile = pics.length > 2 ? 230 : 300;
  return h(
    'div',
    { width: W, height: H, backgroundColor: SKETCH.paper, color: INK, fontFamily: 'Geist', position: 'relative' },
    h(
      'div',
      { width: 580, flexDirection: 'column', padding: '64px 0 88px 72px' },
      night ? h('div', { fontFamily: 'Geist Mono', fontSize: 22, letterSpacing: 3, color: MUTED }, night.toUpperCase()) : null,
      h('div', { fontFamily: 'Instrument Serif', fontSize: menu.name.length > 24 ? 84 : 108, lineHeight: 0.98, letterSpacing: -2, marginTop: 18 }, menu.name),
      h('div', { fontSize: 27, lineHeight: 1.35, color: PENCIL, marginTop: 26, maxHeight: 110, overflow: 'hidden' }, drinksLine(menu, drinks)),
      h('div', { flexGrow: 1 }),
      h(
        'div',
        { alignItems: 'center', gap: 16 },
        h('div', { width: 48, height: 48, borderRadius: 24, backgroundColor: PENCIL, color: SKETCH.paper, alignItems: 'center', justifyContent: 'center', fontSize: 22 }, menu.owner.name.slice(0, 1).toUpperCase()),
        h('div', { fontSize: 24, color: PENCIL }, `Shared by ${menu.owner.name}`),
      ),
    ),
    h(
      'div',
      // Satori wraps only inside a known width: two across, two down.
      { width: W - 580, flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', padding: '24px 48px 80px 8px', gap: 8 },
      ...pics.map((p) => h('div', { width: tile, height: tile, alignItems: 'center', justifyContent: 'center' }, img(p, p.kind === 'glass' ? Math.round(tile * 0.42) : p.kind === 'photo' ? tile - 16 : tile))),
    ),
    h(
      'div',
      { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: INK, color: SKETCH.paper, alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' },
      h('div', { fontFamily: 'Instrument Serif', fontSize: 30 }, 'Cocktail'),
      h('div', { fontFamily: 'Geist Mono', fontSize: 19, letterSpacing: 2 }, 'MENU MADE WITH COCKTAIL'),
    ),
  );
}

export default async function handler(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id');
  const db = supabaseFromEnv(process.env);
  if (!isUuid(id) || !db) return new Response('Not found', { status: 404 });
  const menu = await fetchSharedMenu(db, id);
  if (!menu) return new Response('Not found', { status: 404, headers: { 'cache-control': 'public, max-age=60' } });
  const drinks = await fetchPreviewDrinks(db, menu.sections.flatMap((s) => s.item_ids).filter(isUuid));
  const night = nightLabel(menu.menu_date) ?? '';
  const [pics, sans, serif, mono] = await Promise.all([
    pictures(db, menu, drinks),
    googleFont('Geist', 400, `${drinksLine(menu, drinks)}Shared by ${menu.owner.name}${menu.owner.name.slice(0, 1).toUpperCase()}`),
    googleFont('Instrument Serif', 400, `${menu.name}Cocktail`),
    googleFont('Geist Mono', 500, `${night.toUpperCase()}MENU MADE WITH COCKTAIL`),
  ]);
  // The element tree is React-shaped; ImageResponse's type wants a ReactElement.
  return new ImageResponse(card(menu, drinks, pics) as unknown as ConstructorParameters<typeof ImageResponse>[0], {
    width: W,
    height: H,
    fonts: [
      { name: 'Geist', data: sans, weight: 400, style: 'normal' },
      { name: 'Instrument Serif', data: serif, weight: 400, style: 'normal' },
      { name: 'Geist Mono', data: mono, weight: 500, style: 'normal' },
    ],
    // The URL carries the menu's version (middleware.ts), so a cached image is never stale.
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800, immutable' },
  });
}
