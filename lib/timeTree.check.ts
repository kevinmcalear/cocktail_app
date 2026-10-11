import assert from 'node:assert/strict';

import type { TreeNode } from './drinkTree';
import { placeOptions, timelineSections } from './timeline';
import { axisEras, axisFamilies, axisX, historyEyebrow, tierOf } from './timeTree';

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

// The axis runs left to right, padded at both ends, and never leaves the chart.
assert.ok(Math.abs(axisX(1630) - 0.015) < 1e-9);
assert.ok(Math.abs(axisX(2026) - 0.975) < 1e-9);
assert.ok(axisX(1500) === axisX(1630), 'before Punch sits at the start');
assert.ok(axisX(3000) <= 0.975);
assert.ok(axisX(1862) < axisX(1919) && axisX(1919) < axisX(2005));
// The busy golden age gets more room per year than the punch-bowl centuries.
assert.ok(axisX(1900) - axisX(1850) > axisX(1800) - axisX(1750));
// Era bands tile the axis; Prohibition is labelled Dry to fit.
const eras = axisEras();
assert.equal(eras[0].x, axisX(1630));
for (let i = 1; i < eras.length; i++) assert.ok(Math.abs(eras[i - 1].x + eras[i - 1].w - eras[i].x) < 1e-9);
assert.ok(eras.some((e) => e.name === 'Dry'));

const nodes = [
  node('s:punch', 'trunk', null, 1632),
  node('s:aperitivo', 'negroni', null, 1786),
  node('d:negroni', 'negroni', 's:aperitivo', 1919, { city: 'Florence', spirits: ['gin', 'aperitivo'] }),
  node('d:boulevardier', 'negroni', 'd:negroni', 1927, { bar: "Harry's Bar", city: 'Paris', spirits: ['whiskey', 'aperitivo'] }),
  node('d:left-hand', 'negroni', 'd:boulevardier', 2007, { modern: true, city: 'New York', spirits: ['whiskey'] }),
  node('d:white-negroni', 'negroni', 'd:negroni', 2001, { modern: true, city: 'Paris' }),
  node('d:no-year', 'negroni', 'd:negroni', null),
  node('s:sour', 'sour', 's:punch', 1856),
];

assert.equal(tierOf(nodes[0]), 'style');
assert.equal(tierOf(nodes[2]), 'classic');
assert.equal(tierOf(nodes[4]), 'modern');

// The trunk comes first; families keep the tree's order, parent first, and point at their parent's row.
const fams = axisFamilies(nodes);
assert.deepEqual(fams.map((f) => f.key), ['trunk', 'negroni', 'sour']);
const negroni = fams[1];
assert.equal(negroni.drinks, 5);
assert.deepEqual(negroni.rows.map((r) => r.node.key), ['s:aperitivo', 'd:negroni', 'd:boulevardier', 'd:left-hand', 'd:white-negroni', 'd:no-year']);
assert.deepEqual(negroni.rows.map((r) => r.parentRow), [null, 0, 1, 2, 1, 1]);
// An undated drink is drawn at its parent's year.
const noYear = negroni.rows.find((r) => r.node.key === 'd:no-year')!;
assert.equal(noYear.undated, true);
assert.equal(noYear.x, axisX(1919));
// The Sour's parent is Punch, in the trunk: "from Punch", no line inside its family.
assert.equal(fams[2].rows[0].from?.key, 's:punch');
assert.equal(fams[2].rows[0].parentRow, null);

// Modern classics only: the rest drop out, and so do the lines to parents not shown.
const modern = axisFamilies(nodes, { modernOnly: true });
assert.deepEqual(modern.map((f) => f.key), ['negroni']);
assert.deepEqual(modern[0].rows.map((r) => [r.node.key, r.parentRow]), [['d:left-hand', null], ['d:white-negroni', null]]);
assert.equal(modern[0].drinks, 5, 'the count is the whole family');

assert.equal(historyEyebrow(nodes), 'punch, 1632, to now · 5 classics · 3 styles');

// The Timeline's Spirit and Bar or city filters.
const drinkKeys = (f: Parameters<typeof timelineSections>[1]) => timelineSections(nodes, f).flatMap((s) => s.data.filter((r) => r.node.kind === 'drink').map((r) => r.node.key));
assert.deepEqual(drinkKeys({ family: null, styles: false, spirit: 'whiskey' }), ['d:boulevardier', 'd:left-hand']);
assert.deepEqual(drinkKeys({ family: null, styles: false, place: 'Paris' }), ['d:boulevardier', 'd:white-negroni']);
assert.deepEqual(drinkKeys({ family: null, styles: false, place: "Harry's Bar" }), ['d:boulevardier']);
// Styles stay as context under a spirit filter.
assert.ok(timelineSections(nodes, { family: null, styles: true, spirit: 'whiskey' }).some((s) => s.data.some((r) => r.node.key === 's:punch')));
assert.deepEqual(placeOptions(nodes).slice(0, 2), [
  { kind: 'city', name: 'Paris', count: 2 },
  { kind: 'city', name: 'Florence', count: 1 },
]);
assert.ok(placeOptions(nodes).some((p) => p.kind === 'bar' && p.name === "Harry's Bar"));

console.log('timeTree checks passed');
