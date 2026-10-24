import assert from 'node:assert/strict';

import type { TreeNode } from './drinkTree';
import { DECADES, decadeCounts, eraBands, eraOf, eraX, foldThread, fromLine, locate, locateKey, placeOptions, shortYear, thread, threadBack, timelineSections, undatedCount, yearAt } from './timeline';

const node = (key: string, family: string, parentKey: string | null, year: number | null, extra: Partial<TreeNode> = {}): TreeNode => ({
  key,
  id: key.slice(2),
  kind: key.startsWith('s:') ? 'style' : 'drink',
  name: key.slice(2),
  year,
  approx: false,
  family,
  parentKey,
  note: null,
  creator: null,
  creatorId: null,
  bar: null,
  barId: null,
  barClosed: false,
  city: null,
  modern: false,
  spirits: [],
  versions: 0,
  ...extra,
});

const nodes = [
  node('s:Punch', 'trunk', null, 1632),
  node('s:Sour', 'sour', 's:Punch', 1856),
  node('d:Whiskey Sour', 'sour', 's:Sour', 1862),
  node('d:Gold Rush', 'sour', 'd:Whiskey Sour', 2000, { approx: true }),
  node('d:Penicillin', 'sour', 'd:Gold Rush', 2005),
  node('d:Manhattan', 'martini', null, 1882),
  node('d:Martinez', 'martini', 'd:Manhattan', 1884),
  node('d:Hanky Panky', 'martini', null, 1925, { approx: true }),
  node('d:Undated', 'sour', null, null),
];

// Eras: boundaries and the weighted scale.
assert.equal(eraOf(1632).key, 'punch');
assert.equal(eraOf(1919).key, 'golden');
assert.equal(eraOf(1920).key, 'prohibition');
assert.equal(eraOf(1934).key, 'tiki');
assert.equal(eraOf(2026).key, 'craft');
assert.equal(eraX(1630), 0);
assert.ok(Math.abs(eraX(2027) - 1) < 1e-9);
assert.ok(eraX(1860) < eraX(1862) && eraX(1862) < eraX(1919));
const bands = eraBands();
assert.equal(bands.length, 6);
assert.ok(Math.abs(bands.reduce((s, b) => s + b.w, 0) - 1) < 1e-9);
assert.ok(Math.abs(eraX(1920) - bands[3].x) < 1e-9, 'an era starts where its band does');
for (const y of [1632, 1806, 1862, 1920, 1937, 2005]) assert.equal(yearAt(eraX(y)), y, `yearAt undoes eraX for ${y}`);
assert.equal(yearAt(-1), 1630);
assert.equal(yearAt(2), 2026);

// Sections: one per era with rows, oldest first, styles optional, undated left out.
const all = timelineSections(nodes, { family: null, styles: true });
assert.deepEqual(all.map((s) => s.era.key), ['punch', 'early', 'golden', 'prohibition', 'craft']);
assert.deepEqual(all[2].data.map((r) => r.node.name), ['Whiskey Sour', 'Manhattan', 'Martinez']);
assert.equal(all[2].drinks, 3);
assert.equal(all[0].drinks, 0, 'styles are not counted as drinks');
assert.equal(all[2].data[0].from?.name, 'Sour');
assert.equal(undatedCount(nodes, { family: null, styles: true }), 1);

const noStyles = timelineSections(nodes, { family: null, styles: false });
assert.ok(noStyles.every((s) => s.data.every((r) => r.node.kind === 'drink')));

// A family keeps its own drinks and the trunk.
const sours = timelineSections(nodes, { family: 'sour', styles: true });
assert.deepEqual(sours.flatMap((s) => s.data.map((r) => r.node.name)), ['Punch', 'Sour', 'Whiskey Sour', 'Gold Rush', 'Penicillin']);

// Years print once per run of the same year.
const same = timelineSections([node('d:A', 'sour', null, 1862), node('d:B', 'sour', null, 1862), node('d:C', 'sour', null, 1876)], { family: null, styles: true });
assert.deepEqual(same[0].data.map((r) => r.newYear), [true, false, true]);

// Decades: drinks only.
const counts = decadeCounts(nodes, { family: null, styles: true });
assert.equal(counts.length, DECADES);
assert.equal(counts[(1860 - 1630) / 10], 1);
assert.equal(counts[(2000 - 1630) / 10], 2);
assert.equal(counts.reduce((a, b) => a + b, 0), 6);

// Jumps.
assert.deepEqual(locate(all, 1880), { sectionIndex: 2, itemIndex: 1 });
assert.deepEqual(locate(all, 1990), { sectionIndex: 4, itemIndex: 0 });
assert.deepEqual(locate(all, 2030), { sectionIndex: 4, itemIndex: 1 });
assert.deepEqual(locateKey(all, 'd:Martinez'), { sectionIndex: 2, itemIndex: 2 });
assert.equal(locateKey(all, 'd:Undated'), null);

// Thread.
assert.deepEqual(thread(nodes, 'd:Penicillin').map((n) => n.name), ['Punch', 'Sour', 'Whiskey Sour', 'Gold Rush', 'Penicillin']);
// Back to the nearest classic: a modern classic in between is skipped; no classic counts to the oldest step.
const penicillin = thread(nodes, 'd:Penicillin').map((n) => (n.name === 'Gold Rush' ? { ...n, modern: true } : n));
assert.equal(threadBack(penicillin), '143 years back to Whiskey Sour, 1862');
assert.equal(threadBack(thread(nodes, 'd:Whiskey Sour')), '230 years back to Punch, 1632');
assert.equal(threadBack(thread(nodes, 's:Punch')), null);

// Following a thread: runs of three or more drinks off it, between its first and last steps, fold to one row; shorter runs stay.
const craft = [2001, 2001, 2002, 2003].map((y, i) => node(`d:Off${i}`, 'sour', null, y));
const busy = [...nodes, ...craft, node('d:Hugo', 'sour', null, 2006)];
const lit = new Set(thread(busy, 'd:Penicillin').map((n) => n.key));
const folded = foldThread(timelineSections(busy, { family: 'sour', styles: true }), lit);
const modern = folded.at(-1)!.data;
assert.deepEqual(modern.map((r) => [r.node.name, r.folded ?? 0]), [['Gold Rush', 0], ['Off0', 4], ['Penicillin', 0], ['Hugo', 0]], 'past the last step nothing folds');
assert.equal(modern[2].newYear, true, 'the row after a fold prints its year');
const short = foldThread(timelineSections([...nodes, craft[0]], { family: 'sour', styles: true }), lit).at(-1)!.data;
assert.deepEqual(short.map((r) => r.node.name), ['Gold Rush', 'Off0', 'Penicillin']);
assert.equal(foldThread(all, new Set(['d:Gold Rush'])).length, all.length, 'one step: nothing to fold');

assert.equal(fromLine({ from: nodes[5] }), 'Riff of Manhattan, 1882');
assert.equal(fromLine({ from: nodes[1] }), 'Riff of Sour, 1856');
assert.equal(fromLine({ from: null }), null);

// Spirit and Bar or city filters (drinks only; styles follow the Styles switch).
const placed = [
  node('s:Sour', 'sour', null, 1856),
  node('d:Penicillin', 'sour', null, 2005, { spirits: ['whisky'], city: 'New York', bar: 'Milk & Honey' }),
  node('d:Gold Rush', 'sour', null, 2000, { spirits: ['whisky'], city: 'New York', bar: 'Milk & Honey' }),
  node('d:Mai Tai', 'tiki', null, 1944, { spirits: ['rum'], city: 'Oakland', bar: "Trader Vic's" }),
];
const names = (f: Parameters<typeof timelineSections>[1]) => timelineSections(placed, f).flatMap((s) => s.data.map((r) => r.node.name));
assert.deepEqual(names({ family: null, styles: false, spirit: 'rum' }), ['Mai Tai']);
assert.deepEqual(names({ family: null, styles: true, place: 'New York' }), ['Sour', 'Gold Rush', 'Penicillin']);
assert.deepEqual(names({ family: null, styles: false, place: "Trader Vic's" }), ['Mai Tai']);
assert.deepEqual(placeOptions(placed).map((p) => `${p.kind}:${p.name}:${p.count}`), ['city:New York:2', 'city:Oakland:1', 'bar:Milk & Honey:2', "bar:Trader Vic's:1"]);

// A best guess shows its decade in the year column; the row says "best guess".
assert.equal(shortYear({ year: 1935, approx: false, guess: 'mid' }), '1930s');
assert.equal(shortYear({ year: 1880, approx: true }), 'c.1880');
assert.equal(shortYear({ year: null, approx: false }), '');

console.log('timeline checks passed');

