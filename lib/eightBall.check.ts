// Checks for lib/eightBall.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { buildPool, classicReason, makeA, NO_SHAKE, pickDrink, readShake, SHAKE, WEIGHT, type Motion, type ShakeState } from './eightBall';

// --- shakes: three strong jolts close together, then a cooldown ---
const rest = (at: number): Motion => ({ x: 0, y: 0, z: -1, at });
const jolt = (at: number): Motion => ({ x: 2.2, y: 1.2, z: -1, at });

function feed(readings: Motion[]): number[] {
  let state: ShakeState = NO_SHAKE;
  const fired: number[] = [];
  for (const m of readings) {
    const next = readShake(state, m);
    state = next.state;
    if (next.shook) fired.push(m.at);
  }
  return fired;
}

assert.deepEqual(feed([rest(0), rest(100), rest(200)]), [], 'resting never shakes');
assert.deepEqual(feed([jolt(0)]), [], 'one bump is not a shake');
assert.deepEqual(feed([jolt(0), jolt(1000), jolt(2000)]), [], 'jolts far apart are not a shake');
assert.deepEqual(feed([jolt(0), jolt(150), jolt(300)]), [300], 'three quick jolts are a shake');
assert.deepEqual(feed([jolt(0), jolt(150), jolt(300), jolt(450), jolt(600), jolt(750)]), [300], 'one long shake fires once');
assert.deepEqual(
  feed([jolt(0), jolt(150), jolt(300), jolt(300 + SHAKE.cooldownMs), jolt(450 + SHAKE.cooldownMs), jolt(600 + SHAKE.cooldownMs)]),
  [300, 600 + SHAKE.cooldownMs],
  'a second shake after the cooldown fires again'
);
assert.deepEqual(feed([{ x: 0, y: 0, z: 0.4, at: 0 }, jolt(100), jolt(200)]), [], 'a soft dip under the threshold is not a jolt');

// --- the pool: can make first, then well rated, then the classics ---
const d = (id: string) => ({ id, name: id, imageUrl: null, glass: null });
const classic = (id: string, extra: Partial<{ year: number; approx: boolean; creator: string; bar: string }> = {}) => ({
  ...d(id),
  year: null,
  approx: false,
  creator: null,
  bar: null,
  ...extra,
});
const pool = buildPool({
  classics: [classic('negroni', { year: 1919 }), classic('daiquiri', { year: 1898, approx: true }), classic('martini')],
  canMake: [d('negroni'), d('house-sour')],
  barDrinks: [
    { ...d('paloma-limantour'), barId: 'limantour' },
    { ...d('negroni'), barId: 'limantour' },
    { ...d('closed-bar-drink'), barId: 'unranked' },
  ],
  ratedBars: [{ id: 'limantour', name: 'Licorería Limantour', score: 10 }],
  near: true,
});
const byId = new Map(pool.map((c) => [c.id, c]));
assert.equal(byId.get('negroni')?.weight, WEIGHT.canMake);
assert.equal(byId.get('negroni')?.reason, 'You have all the bottles at home.', 'can make wins over a classic and a bar drink of the same id');
assert.equal(byId.get('house-sour')?.weight, WEIGHT.canMake, 'what the shelf makes is in, classic or not');
assert.equal(byId.get('daiquiri')?.weight, WEIGHT.classic);
assert.equal(byId.get('daiquiri')?.reason, 'A classic from about 1898.');
assert.equal(byId.get('paloma-limantour')?.weight, WEIGHT.ratedBar * 2, 'a 10 bar doubles the rated weight');
assert.equal(byId.get('paloma-limantour')?.reason, 'Well rated near you, at Licorería Limantour.');
assert.ok(!byId.has('closed-bar-drink'), 'drinks at bars outside the rated list stay out');
assert.deepEqual([...byId.keys()].sort(), ['daiquiri', 'house-sour', 'martini', 'negroni', 'paloma-limantour'], 'nothing else gets in');
assert.equal(
  buildPool({ classics: [], canMake: [], barDrinks: [{ ...d('x'), barId: 'b' }], ratedBars: [{ id: 'b', name: 'B', score: 5 }], near: false })[0].reason,
  'Well rated, at B.'
);
// No rated bars (prod today): a classic from the history, or what the shelf makes.
assert.deepEqual(
  buildPool({ classics: [classic('martini')], canMake: [], barDrinks: [{ ...d('x'), barId: 'b' }], ratedBars: [], near: false }).map((c) => c.id),
  ['martini']
);

assert.equal(classicReason({ year: 2005, approx: false, creator: 'Sam Ross', bar: 'Milk & Honey' }), 'A classic from 2005, by Sam Ross at Milk & Honey.');
assert.equal(classicReason({ year: 1880, approx: true, creator: null, bar: null }), 'A classic from about 1880.');
assert.equal(classicReason({ year: null, approx: false, creator: null, bar: 'Harry\'s New York Bar' }), "A classic, at Harry's New York Bar.");
assert.equal(classicReason({ year: null, approx: false, creator: null, bar: null }), 'A classic from the drink history.');

assert.equal(makeA('Negroni'), 'Make a Negroni');
assert.equal(makeA('Old Fashioned'), 'Make an Old Fashioned');
assert.equal(makeA('Annibale'), 'Make an Annibale');
assert.equal(makeA('A Bird in the Hand'), 'Make A Bird in the Hand');
assert.equal(makeA('The Last Word'), 'Make The Last Word');
assert.equal(makeA('Aviation'), 'Make an Aviation');

// --- picking: by weight, skipping recent ones ---
const weighted = [
  { ...d('a'), weight: 1, reason: '' },
  { ...d('b'), weight: 3, reason: '' },
];
assert.equal(pickDrink(weighted, [], () => 0)?.id, 'a');
assert.equal(pickDrink(weighted, [], () => 0.24)?.id, 'a');
assert.equal(pickDrink(weighted, [], () => 0.26)?.id, 'b');
assert.equal(pickDrink(weighted, [], () => 0.999)?.id, 'b');
assert.equal(pickDrink(weighted, ['b'], () => 0.9)?.id, 'a', 'recent drinks are skipped');
assert.equal(pickDrink(weighted, ['a', 'b'], () => 0)?.id, 'a', 'when everything is recent, pick from everything');
assert.equal(pickDrink([], [], () => 0), null);
assert.equal(pickDrink([{ ...d('z'), weight: 0, reason: '' }]), null);

// Over many picks, the can-make drink comes up about six times as often.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const counts: Record<string, number> = {};
for (let i = 0; i < 9000; i++) {
  const c = pickDrink(pool, [], rand)!;
  counts[c.id] = (counts[c.id] ?? 0) + 1;
}
const ratio = counts.negroni / counts.daiquiri;
assert.ok(ratio > 5 && ratio < 7, `can-make weight ratio ${ratio}`);

console.log('eightBall checks passed');
