import assert from 'node:assert/strict';
import { photoTone } from './photoTone';

const fill = (n: number, rgba: [number, number, number, number]) => Array.from({ length: n }, () => rgba).flat();

// A Negroni on a dark bar: dark. A strawberry Daiquiri on white marble: light.
assert.equal(photoTone(fill(16, [40, 20, 18, 255])), 'dark');
assert.equal(photoTone(fill(16, [236, 228, 222, 255])), 'light');
// Mostly bright with a red drink in the middle still reads light.
assert.equal(photoTone([...fill(12, [240, 238, 235, 255]), ...fill(4, [190, 40, 50, 255])]), 'light');
// Half dark, half light: dark (text on it has to stay readable either way, and glass over a photo was dark).
assert.equal(photoTone([...fill(8, [20, 20, 20, 255]), ...fill(8, [235, 235, 235, 255])]), 'dark');
// Transparent pixels don't count; nothing at all reads dark.
assert.equal(photoTone([...fill(4, [250, 250, 250, 255]), ...fill(12, [0, 0, 0, 0])]), 'light');
assert.equal(photoTone([]), 'dark');
