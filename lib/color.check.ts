// Checks for lib/color.ts and the contrast claims in constants/tokens.ts.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { backbar, DEFAULT_ACCENT, SAMPLE_BRANDS } from '../constants/tokens';
import { accentFill, contrast, isHexColor, parseHex, readableAccent, withAlpha } from './color';

assert.deepEqual(parseHex('#fff'), [255, 255, 255]);
assert.equal(Math.round(contrast('#000000', '#FFFFFF')), 21);

// Body and secondary text meet AA in both themes.
for (const scheme of ['dark', 'light'] as const) {
  const c = backbar[scheme];
  assert.ok(contrast(c.ink, c.ground) >= 4.5, `${scheme} ink`);
  assert.ok(contrast(c.muted, c.ground) >= 4.5, `${scheme} muted on ground`);
  assert.ok(contrast(c.muted, c.surface) >= 4.5, `${scheme} muted on surface`);
}

// Every accent, adjusted, reads as text on both grounds, and text on an accent
// fill always reads.
for (const accent of [DEFAULT_ACCENT, SAMPLE_BRANDS.littleRye.accent, SAMPLE_BRANDS.paleMoth.accent, '#FFFF00', '#101010', '#777777', '#E5484D', '#0D74CE']) {
  for (const scheme of ['dark', 'light'] as const) {
    const { ground } = backbar[scheme];
    const readable = readableAccent(accent, ground);
    assert.ok(contrast(readable, ground) >= 4.5, `${accent} on ${scheme}: ${readable}`);
    const { fill, text } = accentFill(accent, backbar.dark.ground, backbar.light.surface);
    assert.ok(contrast(text, fill) >= 4.5, `text on ${accent}: ${contrast(text, fill).toFixed(2)}`);
  }
}

// An accent that already passes isn't changed.
assert.equal(readableAccent('#E4B062', backbar.dark.ground), '#E4B062');


// A fill that already works is used as is.
assert.equal(accentFill('#E4B062', backbar.dark.ground, backbar.light.surface).fill, '#E4B062');

assert.equal(withAlpha('#D0643B', 0.2), 'rgba(208, 100, 59, 0.2)');

assert.ok(isHexColor('#D0643B') && isHexColor('#fff'));
assert.ok(!isHexColor('red') && !isHexColor(null) && !isHexColor('#12345'));

console.log('color: ok');
