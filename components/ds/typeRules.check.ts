// The type rules (31 Oct 2026): Redaction for names, the system font for the
// rest, tabular figures for amounts, no mono, nothing under 13 pt.
import assert from 'node:assert/strict';

import { displayName, font, fontFamilies, MIN_FONT_SIZE, systemFont, type } from '../../constants/tokens';

for (const [name, style] of Object.entries({ ...type, ...displayName })) {
  assert.ok(style.fontSize >= MIN_FONT_SIZE, `${name} is ${style.fontSize} pt, under ${MIN_FONT_SIZE}`);
}
for (const [name, style] of Object.entries(font)) {
  assert.equal(style.fontFamily, systemFont, `${name} is the system font`);
}
assert.deepEqual(font.figures.fontVariant, ['tabular-nums']);
assert.deepEqual(font.figuresMedium.fontVariant, ['tabular-nums']);
assert.equal(fontFamilies.name, 'Redaction');
assert.ok(!Object.values(fontFamilies).some((f) => /mono/i.test(f)), 'no mono face');
