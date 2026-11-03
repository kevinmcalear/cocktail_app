// Checks for lib/paper/print.ts, label.ts and printHtml.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { dayHues, printPaper } from '../../constants/tokens';
import { contrast } from '../color';
import { labelDate } from '../makeSteps';
import { batchPageUrl, labelHref } from '../itemRoutes';
import { fridgeRows, labelFromBatch, LABEL, prepLabel, type FridgeBatch } from './label';
import { paperFor, sheetSize, type PaperBox, type PaperCode, type PaperPage, type PaperText } from './page';
import { barInk, cardSize, listOnNow, longDate, parseTables, runSheet, specSheet, studySheets, tableCards, type PrintBar, type PrintDrink } from './print';
import { menuPoster } from './poster';
import { pagesHtml } from './printHtml';

const inside = (p: PaperPage) =>
  p.els.every((e) => e.x >= -1 && e.y >= 0 && (e.k === 'drawing' || e.k === 'code' ? e.x + e.s <= p.w + 1 && e.y + e.s <= p.h : e.k === 'box' ? e.x + e.w <= p.w && e.y + e.h <= p.h : e.y + e.size <= p.h));
const texts = (p: PaperPage) => p.els.filter((e): e is PaperText => e.k === 'text').map((e) => e.t);
const codes = (p: PaperPage) => p.els.filter((e): e is PaperCode => e.k === 'code');

const bar: PrintBar = { name: 'Little Rye', accent: '#E8C547', face: 'fraunces' };
const drink = (i: number): PrintDrink => ({
  id: `d${i}`,
  name: `Drink ${i}`,
  line: 'Rye, honey, lemon',
  price: '$16',
  spec: [
    { amount: '60 ml', name: 'Rye' },
    { amount: '22 ml', name: 'Honey syrup' },
    { amount: '22 ml', name: 'Lemon' },
  ],
  serve: 'Rocks · Large cube',
  url: `https://example.test/cocktail/d${i}`,
  publicUrl: `https://example.test/d/d${i}`,
});
const date = new Date(2026, 9, 31, 17);

// A pale bar colour deepens until it reads on white.
assert.ok(contrast(barInk(bar), printPaper.paper) >= 4.5, 'the bar colour reads on paper');
assert.equal(barInk({ ...bar, accent: null }), printPaper.ink);

// The list on now: one Letter page for a short menu, more for a long one, everything on the page.
const short = listOnNow({ bar, menuName: 'Autumn', drinks: [1, 2, 3, 4, 5, 6].map(drink), date, team: 'Ana, Theo' });
assert.equal(short.length, 1);
assert.deepEqual({ w: short[0]!.w, h: short[0]!.h }, { w: 612, h: 792 });
assert.ok(texts(short[0]!).includes('LITTLE RYE'), 'the bar name in caps');
assert.equal(short[0]!.els.find((e): e is PaperText => e.k === 'text' && e.t === 'LITTLE RYE')?.face, 'mono', 'in the typewriter face, as drawn');
assert.ok(texts(short[0]!).includes('Drink 6'));
assert.ok(texts(short[0]!).some((t) => t.includes(longDate(date)) && t.includes('Ana, Theo')), 'the foot says the date and who’s on');
const long = listOnNow({ bar, menuName: 'Everything', drinks: Array.from({ length: 40 }, (_, i) => drink(i)), date, team: null });
assert.ok(long.length > 1, 'a long list carries on over more pages');
assert.equal(long.flatMap(texts).filter((t) => /^Drink \d+$/.test(t)).length, 40, 'every drink once');
for (const p of [...short, ...long]) assert.ok(inside(p));

// A4: the same sheets on A4's points, everything still on the page.
assert.deepEqual(sheetSize('a4'), { w: 595, h: 842 });
const a4 = [...listOnNow({ bar, menuName: 'Everything', drinks: Array.from({ length: 40 }, (_, i) => drink(i)), date, team: null, paper: 'a4' }), specSheet(bar, drink(1), date, 'a4'), ...runSheet(bar, [1, 2, 3].map(drink), date, 'a4'), ...studySheets(bar, 'Autumn', [1, 2].map(drink), 'a4')];
for (const p of a4) assert.deepEqual({ w: p.w, h: p.h, inside: inside(p) }, { w: 595, h: 842, inside: true });
// The paper is where the bar is: Letter in the US, Canada, Mexico; A4 in Brazil, Argentina, Europe and Australia.
for (const z of ['America/New_York', 'America/Toronto', 'America/Mexico_City', 'America/Bogota', 'Pacific/Honolulu']) assert.equal(paperFor(z), 'letter', z);
for (const z of ['America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Lima', 'Europe/London', 'Australia/Sydney', 'Asia/Tokyo']) assert.equal(paperFor(z), 'a4', z);

// Spec sheets: one drink a page, its code opens its page in the app.
const spec = specSheet(bar, drink(1), date);
assert.ok(inside(spec));
assert.deepEqual(codes(spec).map((c) => c.url), [drink(1).url]);
assert.ok(texts(spec).includes('60 ml'));
assert.equal(spec.els.find((e): e is PaperText => e.k === 'text' && e.t === '60 ml')?.face, 'mono', 'amounts in the typewriter face');

// The run sheet and the study sheets keep every drink on the page.
const runs = runSheet(bar, Array.from({ length: 12 }, (_, i) => drink(i)), date);
for (const p of runs) assert.ok(inside(p));
assert.ok(texts(runs[0]!).includes(`RUN SHEET · ${labelDate(date).toUpperCase()}`), 'the run sheet heads with its date, as drawn');
assert.equal(runs.flatMap(codes).length, 12);
const study = studySheets(bar, 'Autumn', [1, 2, 3].map(drink));
for (const p of study) assert.ok(inside(p));
assert.ok(!study.flatMap(texts).includes('60 ml'), 'study sheets leave the amounts to fill in');

// Table cards: one a table, four to a sheet, "Table 6" at the foot, each code opens the table's page.
const cards = tableCards(bar, [1, 2, 3, 4, 6].map((n) => ({ n, url: `https://example.test/p/bar?table=${n}` })));
assert.equal(cards.length, 2);
assert.equal(cardSize('letter').w * 2, 612);
assert.equal(cards[0]!.els.filter((e) => e.k === 'code').length, 4);
assert.ok(texts(cards[1]!).includes('Table 6'));
assert.deepEqual(cards.flatMap(codes).map((c) => c.url.split('=')[1]), ['1', '2', '3', '4', '6']);
for (const p of [...cards, ...tableCards(bar, [{ n: 1, url: 'x' }], 'a4')]) assert.ok(inside(p));
// The tables typed when printing.
assert.deepEqual(parseTables('4'), [1, 2, 3, 4]);
assert.deepEqual(parseTables('1-3, 6, 9–8'), [1, 2, 3, 6, 8, 9]);
assert.deepEqual(parseTables('patio'), []);
assert.equal(parseTables('999').length, 200, 'at most 200 cards');

// The printed poster: the drawings stay on the panel, and a long menu's "and N more" stays above the foot.
const poster = menuPoster({ name: 'Everything', eyebrow: 'Little Rye', drinks: Array.from({ length: 40 }, (_, i) => ({ id: `d${i}`, name: `Drink ${i}`, drawn: i < 3 })), accent: '#D0643B', face: 'fraunces', scheme: 'light' }, 'letter');
const panel = poster.els.find((e): e is PaperBox => e.k === 'box' && e.r === 16)!;
for (const e of poster.els) if (e.k === 'drawing') assert.ok(e.y >= panel.y && e.y + e.s <= panel.y + panel.h + 1, 'drawings sit inside the panel');
const more = poster.els.find((e): e is PaperText => e.k === 'text' && e.t.startsWith('and '))!;
const foot = Math.max(...poster.els.filter((e): e is PaperText => e.k === 'text').map((e) => e.y));
assert.ok(more.y + more.size < foot, '"and N more" sits above the foot');

// The label: the day's colour down the side, the batch's facts, a code to its page.
const made = '2026-10-31T16:00:00.000Z';
const label = labelFromBatch({ name: 'Honey-ginger syrup', madeAt: made, amount: 1200, unit: 'ml', shelfLifeHours: 14 * 24, storage: 'Fridge', allergens: 'No allergens', maker: 'Theo Marsh', url: batchPageUrl('https://example.test', 'i1', 'b1') });
assert.equal(label.by, 'Theo');
assert.equal(label.useBy?.toISOString(), '2026-11-14T16:00:00.000Z');
assert.equal(label.url, 'https://example.test/ingredient/i1?batch=b1');
const drawn = prepLabel(label);
assert.equal(drawn.w, LABEL.w);
assert.ok(inside(drawn));
assert.ok(drawn.els.every((e) => e.k !== 'text' || e.face === 'mono'), 'every label line in the typewriter face, as drawn');
const stripe = drawn.els.find((e): e is PaperBox => e.k === 'box' && e.w === 16);
assert.equal(stripe?.fill, dayHues[new Date(made).getDay()]);
assert.deepEqual(codes(drawn).map((c) => c.url), [label.url]);
assert.equal(labelFromBatch({ name: 'x', madeAt: made, amount: 1, unit: 'batch', shelfLifeHours: null, storage: null, allergens: '', maker: null, url: '' }).useBy, null);

// What Log batch opens: the batch's own facts, so the label draws before it sends.
assert.equal(labelHref({ id: 'b1', itemId: 'i1', amount: 1.2, unit: 'L', madeAt: made }), `/label?batch=b1&item=i1&amount=1.2&unit=L&made=${encodeURIComponent(made)}`);

// In the fridge: each house-made once, by its latest batch, newest first; its last day says so.
const batch = (id: string, itemId: string, madeAt: string, hours: number | null): FridgeBatch => ({ id, itemId, amount: 1, unit: 'L', madeAt, madeBy: null, name: itemId, shelfLifeHours: hours });
const now = new Date('2026-11-01T15:00:00.000Z');
const rows = fridgeRows(
  [batch('a1', 'syrup', '2026-10-25T15:00:00.000Z', 24 * 30), batch('a2', 'syrup', '2026-10-31T15:00:00.000Z', 24 * 30), batch('b', 'oleo', '2026-10-27T15:00:00.000Z', 24 * 5), batch('c', 'grenadine', '2026-10-29T15:00:00.000Z', 24), batch('d', 'water', '2026-10-30T15:00:00.000Z', null)],
  now,
);
assert.deepEqual(rows.map((r) => r.batch.id), ['a2', 'd', 'c', 'b']);
assert.deepEqual(rows.map((r) => r.use), [null, null, 'past', 'today']);

// The print document: one picture a sheet, at the paper's size, and nothing but this app's pictures.
const png = 'data:image/png;base64,iVBORw0KGgo=';
const html = pagesHtml([png, 'javascript:alert(1)', '"><script>x</script>', png], 'letter', 'Run <sheet>');
assert.equal(html.match(/<img /g)?.length, 2);
assert.ok(!html.includes('<script>') && !html.includes('javascript:'));
assert.ok(html.includes('size: 8.5in 11in'));
assert.ok(html.includes('Run &lt;sheet&gt;'));
assert.ok(pagesHtml([png], 'a4', 'A4').includes('size: 8.27in 11.69in'));

// A picture never fills its sheet exactly: iOS would spill a sliver onto a second page.
assert.ok(pagesHtml([png], 'label', 'Label').includes('height: calc(1.26in - 4px)'));

console.log('print checks passed');
