// Checks that textSlack keeps iOS text frames at least as tall as the text.
// Models Yoga's roundLayoutResultsToPixelGrid for a text node (React Native
// 0.86): each edge is rounded in double, stored as float32, then subtracted.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { textSlack, type } from '../../constants/tokens';

const f32 = Math.fround;
const near = (a: number, b: number) => Math.abs(a - b) < 0.0001;

function roundToGrid(value: number, scale: number, ceil: boolean, floor: boolean): number {
  let scaled = value * scale;
  let frac = scaled % 1;
  if (frac < 0) frac += 1;
  if (near(frac, 0)) scaled -= frac;
  else if (near(frac, 1)) scaled += 1 - frac;
  else if (ceil) scaled += 1 - frac;
  else if (floor) scaled -= frac;
  else scaled += (frac >= 0.5 ? 1 : 0) - frac;
  return f32(scaled / scale);
}

/** The height of the box iOS draws a text node's content in. */
function drawnHeight(top: number, content: number, slack: number, scale: number): number {
  const height = f32(content + slack);
  const fractional = !near(Math.round(height * scale), height * scale);
  const frame = f32(roundToGrid(top + height, scale, fractional, !fractional) - roundToGrid(top, scale, false, true));
  return frame - f32(slack);
}

// Every Back Bar line height, one to four lines, on every pixel-grid offset
// down a long page, on 2x and 3x screens.
let shortWithout = 0;
for (const scale of [2, 3]) {
  for (const { lineHeight } of Object.values(type)) {
    for (let lines = 1; lines <= 4; lines++) {
      const content = lineHeight * lines;
      for (let px = 0; px < 5000 * scale; px++) {
        const top = px / scale;
        if (drawnHeight(top, content, 0, scale) < content) shortWithout++;
        assert.ok(drawnHeight(top, content, textSlack, scale) >= content, `${content}pt at y=${top} on ${scale}x`);
      }
    }
  }
}

// The model reproduces the bug, or the check above proves nothing.
assert.ok(shortWithout > 0, 'without slack some frames should come out short');
