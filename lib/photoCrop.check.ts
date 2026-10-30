// Checks for lib/photoCrop.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { coverScale, cropRect, panLimit } from './photoCrop';

const frame = { width: 400, height: 500 };

// A landscape photo fills the frame's height; its sides overhang.
const wide = { width: 4000, height: 3000 };
assert.equal(coverScale(wide, frame), 500 / 3000);
assert.deepEqual(cropRect(wide, frame, { zoom: 1, x: 0, y: 0 }), { originX: 800, originY: 0, width: 2400, height: 3000 }, 'centred, full height, 4:5');

// Moved right by the whole overhang: the left edge of the photo.
const limit = panLimit(wide.width, frame.width, coverScale(wide, frame));
assert.equal(Math.round(limit), 133);
assert.equal(cropRect(wide, frame, { zoom: 1, x: limit, y: 0 }).originX, 0, 'moving the photo right shows its left edge');
assert.equal(cropRect(wide, frame, { zoom: 1, x: -limit, y: 0 }).originX, 1600, 'moving it left shows its right edge');

// Zoomed in twice: half the size, still centred.
assert.deepEqual(cropRect(wide, frame, { zoom: 2, x: 0, y: 0 }), { originX: 1400, originY: 750, width: 1200, height: 1500 });

// Never outside the photo, whatever it's asked.
const far = cropRect(wide, frame, { zoom: 1, x: 9999, y: -9999 });
assert.ok(far.originX >= 0 && far.originY >= 0 && far.originX + far.width <= wide.width && far.originY + far.height <= wide.height, 'stays inside the photo');
assert.equal(cropRect(wide, frame, { zoom: 0.2, x: 0, y: 0 }).height, 3000, 'zoom never goes below filling the frame');

// No overhang, no movement.
assert.equal(panLimit(100, 200, 1), 0);

console.log('photoCrop checks passed');
