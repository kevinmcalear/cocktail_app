// The link preview image for a public bar page: /api/bar-og?id=<profile id or
// handle> (ppl-og-images, the bar card). The bar on paper: what kind and
// where, its name, its menu on now, its logo (or initials) and score, and up
// to two of the menu's drinks (photos, or their own sketches). middleware.ts
// points chat apps here.

import { ImageResponse } from '@vercel/og';

import { SKETCH } from '../constants/sketch';
import { barKicker, fetchPreviewBar, onNowLine, pictureDrinks, scoreLine, type PreviewBar } from '../lib/barPreview';
import { fetchPreviewDrinks, fetchSketchInputs, supabaseFromEnv } from '../lib/menuPreview';
import { GLASS, googleFont, h, img, photo, type El, type Picture } from '../lib/ogCard';
import { paintSketch } from '../lib/sketch/paint';
import { sceneToSvg } from '../lib/sketch/svg';
import type { SketchInputs } from '../lib/sketch/types';

export const config = { runtime: 'edge' };

const W = 1200;
const H = 630;
const INK = '#1A1714';
const MUTED = '#6B645B';
const PENCIL = SKETCH.graphite;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Each drink's photo, else its own sketch; a drink with neither is left out. */
async function pictures(db: Parameters<typeof fetchSketchInputs>[0], b: PreviewBar): Promise<Picture[]> {
  const ids = pictureDrinks(b).map((d) => d.id);
  if (!ids.length) return [];
  const [drinks, sketches] = await Promise.all([fetchPreviewDrinks(db, ids), fetchSketchInputs<SketchInputs>(db, ids)]);
  const out = await Promise.all(
    ids.map(async (id): Promise<Picture | null> => {
      const d = drinks.find((x) => x.id === id);
      if (!d) return null;
      if (d.image_url && !d.image_is_generated) {
        const src = await photo(d.image_url);
        if (src) return { src, kind: 'photo' };
      }
      const row = sketches.find((s) => s.item_id === id);
      // Seeded with the drink's id, so it's the same drawing the app shows.
      return row ? { src: `data:image/svg+xml;base64,${btoa(sceneToSvg(paintSketch(row.inputs, { seed: id }), { size: 512 }))}`, kind: 'sketch' } : null;
    })
  );
  return out.filter((p): p is Picture => !!p);
}

function card(b: PreviewBar, pics: Picture[], logo: string | null): El {
  const line = onNowLine(b);
  const score = scoreLine(b);
  return h(
    'div',
    { width: W, height: H, backgroundColor: SKETCH.paper, color: INK, fontFamily: 'Geist', position: 'relative' },
    h(
      'div',
      { width: 640, flexDirection: 'column', padding: '64px 0 88px 72px' },
      h('div', { fontFamily: 'Geist Mono', fontSize: 22, letterSpacing: 3, color: MUTED }, barKicker(b).toUpperCase()),
      h('div', { fontFamily: 'Instrument Serif', fontSize: b.name.length > 16 ? 96 : 132, lineHeight: 0.98, letterSpacing: -2, marginTop: 18 }, b.name),
      line ? h('div', { fontSize: 27, lineHeight: 1.35, color: PENCIL, marginTop: 26, maxHeight: 110, overflow: 'hidden' }, line) : null,
      h('div', { flexGrow: 1 }),
      h(
        'div',
        { alignItems: 'center', gap: 16 },
        logo
          ? { type: 'img', props: { src: logo, width: 48, height: 48, style: { borderRadius: 24, objectFit: 'cover' } } }
          : h('div', { width: 48, height: 48, borderRadius: 24, backgroundColor: PENCIL, color: SKETCH.paper, alignItems: 'center', justifyContent: 'center', fontFamily: 'Instrument Serif', fontSize: 22 }, initials(b.name)),
        score ? h('div', { fontSize: 24, color: PENCIL }, score) : null
      )
    ),
    h(
      'div',
      { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 40px 56px 0' },
      // No drink to draw (a locked page, no menu on): the plain glass, as on a drink's card.
      ...(pics.length ? pics.map((p) => img(p, pics.length > 1 ? 250 : 380)) : [img({ src: GLASS, kind: 'glass' }, 180)])
    ),
    h(
      'div',
      { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: INK, color: SKETCH.paper, alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' },
      h('div', { fontFamily: 'Instrument Serif', fontSize: 30 }, 'Cocktail'),
      h('div', { fontFamily: 'Geist Mono', fontSize: 20, letterSpacing: 2 }, 'A BAR ON COCKTAIL')
    )
  );
}

export default async function handler(request: Request): Promise<Response> {
  const db = supabaseFromEnv(process.env);
  if (!db) return new Response('Not found', { status: 404 });
  const b = await fetchPreviewBar(db, new URL(request.url).searchParams.get('id'));
  if (!b) return new Response('Not found', { status: 404, headers: { 'cache-control': 'public, max-age=60' } });
  const [pics, logo, sans, serif, mono] = await Promise.all([
    pictures(db, b),
    b.logoUrl ? photo(b.logoUrl) : Promise.resolve(null),
    googleFont('Geist', 400, `${onNowLine(b) ?? ''}${scoreLine(b) ?? ''}`),
    googleFont('Instrument Serif', 400, `${b.name}${initials(b.name)}Cocktail`),
    googleFont('Geist Mono', 500, `${barKicker(b).toUpperCase()}A BAR ON COCKTAIL`),
  ]);
  // The element tree is React-shaped; ImageResponse's type wants a ReactElement.
  return new ImageResponse(card(b, pics, logo) as unknown as ConstructorParameters<typeof ImageResponse>[0], {
    width: W,
    height: H,
    fonts: [
      { name: 'Geist', data: sans, weight: 400, style: 'normal' },
      { name: 'Instrument Serif', data: serif, weight: 400, style: 'normal' },
      { name: 'Geist Mono', data: mono, weight: 500, style: 'normal' },
    ],
    // The URL carries the bar's version (middleware.ts), so a cached image is never stale.
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800, immutable' },
  });
}
