// Checks for lib/paper/poster.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { BRAND } from '../../constants/brand';
import { posterPaper } from '../../constants/tokens';
import { contrast } from '../color';
import { topThree } from '../ranking';
import { fitSize, POSTER_SIZES, type PaperPage, type PaperText } from './page';
import { menuPoster, topThreePoster } from './poster';

const texts = (p: PaperPage) => p.els.filter((e): e is PaperText => e.k === 'text');
const drawings = (p: PaperPage) => p.els.filter((e) => e.k === 'drawing');
const inside = (p: PaperPage) =>
  p.els.every((e) => e.x >= -1 && e.y >= 0 && (e.k === 'drawing' ? e.x + e.s <= p.w + 1 && e.y + e.s <= p.h : e.k === 'box' ? e.x + e.w <= p.w && e.y + e.h <= p.h : e.y + e.size <= p.h));

const winter = {
  name: 'Winter',
  eyebrow: 'Little Rye',
  drinks: [
    { id: 'of', name: 'Pine Old Fashioned', drawn: true },
    { id: 'td', name: 'Hot Toddy', drawn: false },
    { id: 'jr', name: 'Jack Rose', drawn: true },
    { id: 'pn', name: 'Penicillin', drawn: true },
    { id: 'ss', name: 'Smoke Signal', drawn: true },
  ],
  accent: '#D0643B',
  face: 'fraunces' as const,
  scheme: 'light' as const,
};

// Story and square are 9:16 and 1:1, three pixels a unit.
for (const [size, { w, h }] of Object.entries(POSTER_SIZES)) {
  const page = menuPoster(winter, size as keyof typeof POSTER_SIZES);
  assert.equal(page.w, w);
  assert.equal(page.h, h);
  assert.ok(inside(page), `${size}: everything sits on the page`);
  // The first three drinks with drawings, the middle one drawn last (on top).
  assert.deepEqual(drawings(page).map((d) => d.k === 'drawing' && d.itemId), ['of', 'pn', 'jr']);
  assert.equal(page.displayFace, 'fraunces');
  // The app's name at the foot comes from constants/brand.ts, never typed in.
  assert.equal(texts(page).at(-1)?.t, BRAND.productName.toLowerCase());
  // Cream ink reads on the bar's colour, deepened from #D0643B as drawn.
  assert.ok(contrast(page.ground, posterPaper.cream) >= 4.5);
  assert.ok(texts(page).every((t) => t.color === posterPaper.cream));
}

// A story lists the drinks; a square has no room.
const story = menuPoster(winter, 'story');
assert.ok(texts(story).some((t) => t.t === 'Hot Toddy'));
assert.ok(!texts(menuPoster(winter, 'square')).some((t) => t.t === 'Hot Toddy'));
assert.equal(texts(story)[0].t, 'LITTLE RYE');

// A long menu ends with "and N more" above the footer.
const long = menuPoster({ ...winter, drinks: Array.from({ length: 30 }, (_, i) => ({ id: `d${i}`, name: `Drink ${i}`, drawn: false })) }, 'story');
assert.ok(inside(long));
assert.match(texts(long).at(-2)!.t, /^and \d+ more$/);
assert.equal(drawings(long).length, 0);
// Nothing drawn yet: no empty panel.
assert.ok(!long.els.some((e) => e.k === 'box'));
assert.equal(menuPoster(winter, 'story').els.filter((e) => e.k === 'box').length, 1);

// A light bar colour takes dark ink; a home menu sits on the paper of its theme.
const amber = menuPoster({ ...winter, accent: '#E4B062' }, 'square');
assert.ok(contrast(amber.ground, texts(amber)[0].color) >= 4.5);
assert.equal(menuPoster({ ...winter, accent: null, eyebrow: null }, 'square').ground, posterPaper.day);
assert.equal(menuPoster({ ...winter, accent: null, eyebrow: null, scheme: 'dark' }, 'square').ground, posterPaper.night);

// A long name is set smaller to fit, never under its floor.
assert.equal(fitSize('Winter', 58, 328), 58);
assert.ok(fitSize('The Long Winter Menu of Little Rye', 58, 328) < 58);
// A menu's long name is sized to its one line, not cut off.
const title50 = 'A very long menu name indeed'.repeat(2).slice(0, 50);
const longTitle = texts(menuPoster({ ...winter, name: title50 }, 'square')).find((t) => t.t === title50)!;
assert.ok(longTitle.size * 0.48 * title50.length <= longTitle.w);

// Top three: a column each, drawn by night in the dark.
const top = topThreePoster(
  {
    person: 'Kevin',
    listName: 'Negroni',
    entries: [
      { itemId: 'a', score: 9.24, bar: 'Little Rye', maker: 'Jo Park', drawn: true },
      { itemId: 'b', score: 9, bar: 'Caretaker’s', maker: null, drawn: true },
      { itemId: 'c', score: 8.4, bar: 'Pale Moth', maker: 'Maya Okafor', drawn: false },
      { itemId: 'd', score: 8, bar: 'Fourth', maker: null, drawn: true },
    ],
    scheme: 'dark',
  },
  'square',
);
assert.ok(inside(top));
assert.equal(texts(top)[0].t, 'KEVIN’S BEST NEGRONIS');
assert.deepEqual(texts(top).filter((t) => t.size === 40).map((t) => t.t), ['9.2', '9.0', '8.4']);
assert.deepEqual(drawings(top).map((d) => d.k === 'drawing' && d.night), [true, true]);
assert.equal(top.ground, posterPaper.night);
assert.ok(!texts(top).some((t) => t.t === 'Fourth'));
assert.match(top.alt, /^Kevin’s best Negronis: 1, Little Rye by Jo Park, 9\.2/);

// One entry sits in the middle; no name reads "My best".
const one = topThreePoster({ person: null, listName: 'Martini', entries: [{ itemId: 'a', score: 7, bar: null, maker: null, drawn: true }], scheme: 'light' }, 'story');
assert.ok(inside(one));
assert.equal(texts(one)[0].t, 'MY BEST MARTINIS');
const pic = drawings(one)[0];
assert.ok(pic.k === 'drawing' && Math.abs(pic.x + pic.s / 2 - one.w / 2) < 1);

// A top three skips what they disliked, and stops at three.
const entries = (['loved', 'fine', 'disliked', 'loved'] as const).map((sentiment, i) => ({ sentiment, i }));
assert.deepEqual(topThree(entries).map((e) => e.i), [0, 1, 3]);
assert.deepEqual(topThree([{ sentiment: 'disliked' as const }]), []);

console.log('poster checks passed');
