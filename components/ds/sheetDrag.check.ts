// Checks the sheet's drag numbers (sheetDrag.ts). Run: npm run test:unit
import assert from 'node:assert/strict';

import { dragCloses, dragShade, FLICK, leaveDuration, rubberBand, STRETCH } from './sheetDrag';

const H = 600;
// Pulled a quarter of the way and let go: closes. Less: springs back.
assert.equal(dragCloses(H * 0.3, 0, H), true);
assert.equal(dragCloses(H * 0.2, 0, H), false);
// A flick closes from a short drag; flicking back up keeps it open from a long one.
assert.equal(dragCloses(20, FLICK + 1, H), true);
assert.equal(dragCloses(H * 0.5, -600, H), false);
// Not dragged down (content scrolling, or pulled up): never closes.
assert.equal(dragCloses(0, 3000, H), false);
assert.equal(dragCloses(-10, 3000, H), false);

// Leaves at the finger's speed, within bounds.
assert.equal(leaveDuration(500, 0), 300);
assert.equal(leaveDuration(500, 5000), 300);
assert.equal(leaveDuration(400, 6000), 200);
assert.equal(leaveDuration(100, 20000), 140);

// The rubber band gives less and less, and never past its limit.
assert.equal(rubberBand(0, STRETCH), 0);
assert.ok(rubberBand(20, STRETCH) < 20);
assert.ok(rubberBand(200, STRETCH) - rubberBand(100, STRETCH) < rubberBand(100, STRETCH) - rubberBand(0, STRETCH));
assert.ok(rubberBand(100000, STRETCH) < STRETCH);

// The backdrop lightens with the pull, and isn't touched by a pull up.
assert.equal(dragShade(0, H), 1);
assert.equal(dragShade(H / 2, H), 0.5);
assert.equal(dragShade(-20, H), 1);
assert.equal(dragShade(H * 2, H), 0);

console.log('sheetDrag: closes on a long pull or a flick, leaves at finger speed, rubber-bands up');
