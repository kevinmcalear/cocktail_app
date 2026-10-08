import assert from 'node:assert/strict';

import { addPick, groupByRing, labelPos, layoutLabels, MAP_SIZE, mapSizeFor, placePairs, RINGS } from './flavorMap';

const pairs = Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, name: `Pair ${i}`, score: 25 - i, together: [25 - i] }));
const placed = placePairs(pairs);

// Only as many as the rings hold, best first, ring by ring.
assert.equal(MAP_SIZE, 18);
assert.equal(placed.length, MAP_SIZE);
assert.deepEqual(
  placed.map((p) => p.ring),
  RINGS.flatMap((r, i) => Array(r.size).fill(i))
);
assert.equal(placed[0].id, 'p0');

// Everything inside the map, and further rings further out.
for (const p of placed) assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1, `${p.id} inside`);
const dist = (p: { x: number; y: number }) => Math.hypot(p.x - 0.5, p.y - 0.5);
assert.ok(dist(placed[0]) < dist(placed[5]) && dist(placed[5]) < dist(placed[12]));

// Stronger pairs get bigger dots.
assert.ok(placed[0].dot > placed[17].dot);

// A short list fills the inner ring first.
assert.deepEqual(placePairs(pairs.slice(0, 3)).map((p) => p.ring), [0, 0, 0]);
assert.deepEqual(placePairs([]), []);

// Labels point away from the middle and stay on the map.
const at = (angle: number) => ({ x: 0.5 + 0.38 * Math.cos(angle), y: 0.5 + 0.38 * Math.sin(angle), dot: 0.02, angle });
const right = labelPos(at(0), 'Smoked Salt', 340, 13);
assert.equal(right.anchor, 'start', 'a right-hand label goes to the right of its dot');
const left = labelPos(at(Math.PI), 'Smoked Salt', 340, 13);
assert.equal(left.anchor, 'end', 'a left-hand label goes to the left of its dot');
// One too long for its side moves above or below, or hides; it's never clamped back over the middle.
const longRight = layoutLabels([{ ...at(0), id: 'x', name: 'Orange Blossom Water', score: 1, together: [1], ring: 0 }], 340, 13, 7.4, 40)[0];
assert.ok(longRight.hidden || longRight.anchor === 'middle', 'no side label that runs off the map');
const roomy = layoutLabels([{ ...at(-0.6), id: 'y', name: 'Orange Blossom Water', score: 1, together: [1], ring: 0 }], 340, 13, 7.4, 40)[0];
assert.equal(roomy.hidden, false, 'with room above, it shows');
const top = labelPos(at(-Math.PI / 2), 'Salt', 340, 13);
assert.equal(top.anchor, 'middle');
assert.ok(top.y < 340 * at(-Math.PI / 2).y, 'a top label sits above its dot');
assert.equal(mapSizeFor(375), 14);
assert.equal(mapSizeFor(800), MAP_SIZE);

// No two shown labels overlap, on a phone-sized map with real names (mezcal and lime's top pairs).
const names = ['Agave Syrup', 'Chilli', 'Tequila', 'Agave Nectar', 'Pineapple Juice', 'Salt', 'Blanco Tequila', 'Chile Liqueur', 'Orange Liqueur', 'Curaçao', 'Ginger Beer', 'Passion Fruit', 'Mango', 'Grapefruit Soda'];
const real = placePairs(names.map((name, i) => ({ id: `n${i}`, name, score: 14 - i, together: [14 - i] })));
const labels = layoutLabels(real, 340, 13, 7.4, 40);
const shown = labels.filter((l) => !l.hidden);
assert.ok(shown.length >= 10, `most labels fit (${shown.length} of 14)`);
const span = (l: (typeof labels)[number]) => {
  const w = names[Number(l.id.slice(1))].length * 7.4;
  const x0 = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2;
  return { x0, x1: x0 + w, y0: l.y - 13, y1: l.y + 3 };
};
for (let i = 0; i < shown.length; i++) {
  const a = span(shown[i]);
  assert.ok(a.x0 >= 0 && a.x1 <= 340, `${shown[i].id} stays on the map`);
  for (let j = i + 1; j < shown.length; j++) {
    const b = span(shown[j]);
    assert.ok(!(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1), `${shown[i].id} and ${shown[j].id} overlap`);
  }
}

// The list groups the same way the rings do.
assert.deepEqual(groupByRing(pairs).map((g) => g.items.length), [4, 6, 8]);
assert.deepEqual(groupByRing(pairs.slice(0, 5)).map((g) => g.ring.label), ['Closest', 'Strong']);

// Bouncing keeps the last three picks, never a duplicate.
assert.deepEqual(addPick(['a'], 'b'), ['a', 'b']);
assert.deepEqual(addPick(['a', 'b', 'c'], 'd'), ['b', 'c', 'd']);
assert.deepEqual(addPick(['a', 'b'], 'a'), ['a', 'b']);

console.log('flavorMap checks passed');
