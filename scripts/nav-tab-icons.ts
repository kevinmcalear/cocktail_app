// Draws the native tab bars' icons from the app's icon set (components/ui/glyphs.ts),
// so iOS and Android show the same drawings as the web and the nav-icons board.
// White on clear at 96 px (24 pt at @4x), so the tab bar tints them, an off and an
// on image per tab (on adds the fill at 22%), and Tonight's page for each day of
// the month. Run from the repo root after changing a tab's glyph:
//   npx tsx scripts/nav-tab-icons.ts
// ponytail: renders with @resvg/resvg-wasm and draws the date with
// @shuding/opentype.js, both installed by @vercel/og; add them as devDependencies
// if that ever goes.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { initWasm, Resvg } from '@resvg/resvg-wasm';
// @ts-expect-error: untyped; the Font type below is the little it's used for.
import * as opentype from '@shuding/opentype.js';

import { GLYPHS, ICON_FILL, ICON_STROKE, type GlyphName } from '../components/ui/glyphs';

const require = createRequire(import.meta.url);
const OUT = 'assets/images/tabs';
const PX = 96;

/** The tab bar's tabs by route name (components/nav/AppTabs.tsx), and Android's Search tab. */
export const TAB_GLYPHS = {
  library: 'place.library',
  menus: 'place.menus',
  prep: 'place.prep',
  test: 'place.study',
  discover: 'place.discover',
  bar: 'place.mybar',
  collection: 'place.collection',
  profile: 'place.you',
  new: 'plus',
  search: 'magnifyingglass',
} as const satisfies Record<string, GlyphName>;

/** The date as a path (the wasm renderer draws no text): Geist SemiBold, centred, baseline at 18. */
type Font = { getAdvanceWidth(text: string, size: number): number; getPath(text: string, x: number, y: number, size: number): { toPathData(decimals: number): string } };
let geist: Font;
const dayPath = (day: number) => geist.getPath(String(day), 12 - geist.getAdvanceWidth(String(day), 8) / 2, 18, 8).toPathData(3);

function svg(name: GlyphName, on: boolean, day?: number) {
  const g = GLYPHS[name];
  const fill = on && g.f ? `<path d="${g.f}" fill="#fff" fill-opacity="${g.solid ? 1 : ICON_FILL}"/>` : '';
  const line = g.d ? `<path d="${g.d}" fill="none" stroke="#fff" stroke-width="${ICON_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>` : '';
  const date = day ? `<path d="${dayPath(day)}" fill="#fff"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${fill}${line}${date}</svg>`;
}

async function main() {
  await initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  const ttf = readFileSync(require.resolve('@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf'));
  const ot = ((opentype as { default?: unknown }).default ?? opentype) as { parse(buffer: ArrayBufferLike): Font };
  geist = ot.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
  const png = (markup: string) => new Resvg(markup, { fitTo: { mode: 'width', value: PX } }).render().asPng();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(`${OUT}/tonight`, { recursive: true });
  for (const [tab, name] of Object.entries(TAB_GLYPHS)) {
    writeFileSync(`${OUT}/${tab}@4x.png`, png(svg(name, false)));
    if (GLYPHS[name].f) writeFileSync(`${OUT}/${tab}-on@4x.png`, png(svg(name, true)));
  }
  for (let day = 1; day <= 31; day++) {
    writeFileSync(`${OUT}/tonight/${day}@4x.png`, png(svg('place.tonight', false, day)));
    writeFileSync(`${OUT}/tonight/${day}-on@4x.png`, png(svg('place.tonight', true, day)));
  }
  console.log(`Wrote ${OUT}`);
}

void main();
