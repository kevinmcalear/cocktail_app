// Checks for lib/color.ts and the contrast claims in constants/tokens.ts.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { backbar, DEFAULT_ACCENT, SAMPLE_BRANDS } from '../constants/tokens';
import { contrast, hexToHsv, hsvToHex, isHexColor, parseHex, readableAccent, withAlpha } from './color';

assert.deepEqual(parseHex('#fff'), [255, 255, 255]);
assert.equal(Math.round(contrast('#000000', '#FFFFFF')), 21);

// Body and secondary text meet AA in both themes.
for (const scheme of ['dark', 'light'] as const) {
  const c = backbar[scheme];
  assert.ok(contrast(c.ink, c.ground) >= 4.5, `${scheme} ink`);
  assert.ok(contrast(c.muted, c.ground) >= 4.5, `${scheme} muted on ground`);
  assert.ok(contrast(c.muted, c.surface) >= 4.5, `${scheme} muted on surface`);
}

// Every accent, adjusted, reads as text on both grounds (buttons: lib/theme.check.ts).
for (const accent of [DEFAULT_ACCENT, SAMPLE_BRANDS.littleRye.accent, SAMPLE_BRANDS.paleMoth.accent, '#FFFF00', '#101010', '#777777', '#E5484D', '#0D74CE']) {
  for (const scheme of ['dark', 'light'] as const) {
    const { ground } = backbar[scheme];
    const readable = readableAccent(accent, ground);
    assert.ok(contrast(readable, ground) >= 4.5, `${accent} on ${scheme}: ${readable}`);
  }
}

// An accent that already passes isn't changed.
assert.equal(readableAccent('#E4B062', backbar.dark.ground), '#E4B062');


assert.equal(withAlpha('#D0643B', 0.2), 'rgba(208, 100, 59, 0.2)');

assert.ok(isHexColor('#D0643B') && isHexColor('#fff'));
assert.ok(!isHexColor('red') && !isHexColor(null) && !isHexColor('#12345'));

console.log('color: ok');

// HSV round trips, for the custom colour wheel.
assert.equal(hsvToHex(0, 1, 1), '#FF0000');
assert.equal(hsvToHex(120, 1, 1), '#00FF00');
assert.equal(hsvToHex(240, 1, 0.5), '#000080');
assert.equal(hsvToHex(200, 0, 1), '#FFFFFF', 'no saturation is grey whatever the hue');
assert.deepEqual(hexToHsv('#000000'), { h: 0, s: 0, v: 0 });
for (const hex of ['#D0643B', '#1A1410', '#7FD4E8', '#E8B04B', '#FFFFFF']) {
  const { h, s, v } = hexToHsv(hex);
  assert.equal(hsvToHex(h, s, v), hex, `${hex} round trips`);
}
