// Checks that display and title leave room above the ascenders on iOS. When a
// lineHeight is below the font's own line height (ascent + descent), React
// Native skips its centring offset (RCTAttributedTextUtils RCTApplyBaselineOffset)
// and TextKit sits the baseline one descent above the bottom of the line, so
// anything taller than lineHeight - descent is cut off at the top.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { displayFaces, type } from '../../constants/tokens';

// Per em, from the bundled @expo-google-fonts files: hhea descent and the
// tallest lowercase ascender (d, h, k, l, f). Accented capitals still reach
// higher. ponytail: they can clip on a one-line display name; the full font
// line height (1.3 em) would fix that at the cost of airy multi-line titles.
const METRICS: Record<keyof typeof displayFaces, { descent: number; ascender: number }> = {
  instrument: { descent: 0.31, ascender: 0.748 },
  fraunces: { descent: 0.255, ascender: 0.738 },
  bricolage: { descent: 0.27, ascender: 0.712 },
};

for (const variant of ['display', 'title'] as const) {
  const { fontSize, lineHeight } = type[variant];
  for (const [face, m] of Object.entries(METRICS)) {
    const room = lineHeight - m.descent * fontSize - m.ascender * fontSize;
    assert.ok(room >= 1, `${variant} in ${face}: ascenders clip on iOS (${room.toFixed(1)}pt of room above them)`);
  }
}

console.log('displayClip: display and title ascenders fit their line on iOS');
