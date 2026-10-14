import assert from 'node:assert/strict';

import { DIE_BOX, FACE, faceLines, neighbours, randomPose, scaled, SQUARE, toPath } from './eightBallFace';

const c = DIE_BOX / 2;
const dist = ([x, y]: [number, number]) => Math.hypot(x - c, y - c);

// The face's corners sit inside the round window, with room to tilt and drift.
for (const p of FACE) assert.ok(dist(p) < c - 8, `corner inside the window: ${dist(p)}`);
// It's centred on its incentre, so turning it half round (pointing up) keeps the words in place.
const centroid = [(FACE[0][0] + FACE[1][0] + FACE[2][0]) / 3, (FACE[0][1] + FACE[1][1] + FACE[2][1]) / 3];
assert.ok(Math.abs(centroid[0] - c) < 1e-9 && Math.abs(centroid[1] - c) < 1e-9);

// Three neighbours, each sharing an edge with the face and reaching away from it.
const ns = neighbours();
assert.equal(ns.length, 3);
for (const n of ns) {
  const shared = n.filter((p) => FACE.some((f) => f[0] === p[0] && f[1] === p[1]));
  assert.equal(shared.length, 2, 'shares an edge');
  assert.ok(dist(n[2]) > dist(FACE[0]) * 0.9, 'tips away outward');
}
assert.ok(dist(scaled(FACE, 1.2)[0]) > dist(FACE[0]));
assert.match(toPath(FACE), /^M[\d. L]+ Z$/);

// Short answers: a few capitals per line.
assert.deepEqual(faceLines('It is certain'), { lines: ['IT IS', 'CERTAIN'], small: false });
assert.deepEqual(faceLines('Negroni'), { lines: ['NEGRONI'], small: false });
// Three short lines still fit at the normal size, like the toy's "AS I / SEE IT / YES".
assert.deepEqual(faceLines('Smoke & Fig Old Fashioned'), { lines: ['SMOKE &', 'FIG OLD', 'FASHIONED'], small: false });
// Longer names step down to the small size and stay within four lines.
const long = faceLines('Chestnut Brown Butter Old Fashioned');
assert.ok(long.small && long.lines.length <= 4, JSON.stringify(long));
assert.ok(long.lines.every((l) => l.length <= 12));
const huge = faceLines('The Extraordinarily Long Name Of A House Twist On A Classic Cocktail');
assert.equal(huge.lines.length, 4);
assert.ok(huge.lines[3].endsWith('…'));
// One long word still fits, small.
assert.ok(faceLines('Supercalifragilistic').small);

// Poses vary but stay near square on.
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const poses = Array.from({ length: 200 }, () => randomPose(rand));
assert.ok(poses.some((p) => p.up) && poses.some((p) => !p.up), 'points both ways');
for (const p of poses) assert.ok(Math.abs(p.tilt) <= 12 && Math.abs(p.dx) <= 5 && Math.abs(p.dy) <= 5 && Math.abs(p.turnIn) <= 50);
assert.equal(SQUARE.tilt, 0);

console.log('eightBallFace checks passed');
