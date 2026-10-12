// The link preview image for a public drink: /api/drink-og?id=<drink id>
// (ppl-og-drink). The drink on paper: what kind and when, its name, its
// ingredients (or description), who made it, and its picture (its photo, or
// its own sketch drawn from its drawing inputs). middleware.ts points chat apps here.

import { ImageResponse } from '@vercel/og';

import { SKETCH } from '../constants/sketch';
import { createdBy, drinkKickerFor, drinkLine, fetchPreviewDrinkCard, type PreviewDrinkCard } from '../lib/drinkPreview';
import { fetchSketchInputs, isUuid, supabaseFromEnv } from '../lib/menuPreview';
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

async function picture(db: Parameters<typeof fetchSketchInputs>[0], d: PreviewDrinkCard): Promise<Picture> {
  if (d.image_url && !d.image_is_generated) {
    const src = await photo(d.image_url);
    if (src) return { src, kind: 'photo' };
  }
  const [row] = await fetchSketchInputs<SketchInputs>(db, [d.id]);
  // Seeded with the drink's id, so it's the same drawing the app shows.
  return row ? { src: `data:image/svg+xml;base64,${btoa(sceneToSvg(paintSketch(row.inputs, { seed: d.id }), { size: 512 }))}`, kind: 'sketch' } : { src: GLASS, kind: 'glass' };
}

function card(d: PreviewDrinkCard, pic: Picture): El {
  const line = drinkLine(d);
  const by = createdBy(d);
  const who = d.creator ?? d.bar;
  return h(
    'div',
    { width: W, height: H, backgroundColor: SKETCH.paper, color: INK, fontFamily: 'Geist', position: 'relative' },
    h(
      'div',
      { width: 660, flexDirection: 'column', padding: '64px 0 88px 72px' },
      h('div', { fontFamily: 'Geist Mono', fontSize: 22, letterSpacing: 3, color: MUTED }, drinkKickerFor(d).toUpperCase()),
      h('div', { fontFamily: 'Instrument Serif', fontSize: d.name.length > 18 ? 96 : 132, lineHeight: 0.98, letterSpacing: -2, marginTop: 18 }, d.name),
      line ? h('div', { fontSize: 27, lineHeight: 1.35, color: PENCIL, marginTop: 26, maxHeight: 110, overflow: 'hidden' }, line) : null,
      h('div', { flexGrow: 1 }),
      by && who
        ? h(
            'div',
            { alignItems: 'center', gap: 16 },
            h('div', { width: 48, height: 48, borderRadius: 24, backgroundColor: PENCIL, color: SKETCH.paper, alignItems: 'center', justifyContent: 'center', fontSize: 20 }, initials(who)),
            h('div', { fontSize: 24, color: PENCIL }, by)
          )
        : null
    ),
    h('div', { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 56 }, img(pic, pic.kind === 'glass' ? 180 : 420)),
    h(
      'div',
      { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: INK, color: SKETCH.paper, alignItems: 'center', justifyContent: 'space-between', padding: '0 72px' },
      h('div', { fontFamily: 'Instrument Serif', fontSize: 30 }, 'Cocktail'),
      h('div', { fontFamily: 'Geist Mono', fontSize: 20, letterSpacing: 2 }, 'A DRINK ON COCKTAIL')
    )
  );
}

export default async function handler(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id');
  const db = supabaseFromEnv(process.env);
  if (!isUuid(id) || !db) return new Response('Not found', { status: 404 });
  const d = await fetchPreviewDrinkCard(db, id);
  if (!d) return new Response('Not found', { status: 404, headers: { 'cache-control': 'public, max-age=60' } });
  const who = d.creator ?? d.bar ?? '';
  const [pic, sans, serif, mono] = await Promise.all([
    picture(db, d),
    googleFont('Geist', 400, `${drinkLine(d) ?? ''}${createdBy(d) ?? ''}${initials(who)}`),
    googleFont('Instrument Serif', 400, `${d.name}Cocktail`),
    googleFont('Geist Mono', 500, `${drinkKickerFor(d).toUpperCase()}A DRINK ON COCKTAIL`),
  ]);
  // The element tree is React-shaped; ImageResponse's type wants a ReactElement.
  return new ImageResponse(card(d, pic) as unknown as ConstructorParameters<typeof ImageResponse>[0], {
    width: W,
    height: H,
    fonts: [
      { name: 'Geist', data: sans, weight: 400, style: 'normal' },
      { name: 'Instrument Serif', data: serif, weight: 400, style: 'normal' },
      { name: 'Geist Mono', data: mono, weight: 500, style: 'normal' },
    ],
    // The URL carries the drink's version (middleware.ts), so a cached image is never stale.
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800, immutable' },
  });
}
