// Checks that display and title leave room above the ascenders on iOS. When a
// lineHeight is below the font's own line height (ascent + descent), React
// Native skips its centring offset (RCTAttributedTextUtils RCTApplyBaselineOffset)
// and TextKit sits the baseline one descent above the bottom of the line, so
// anything taller than lineHeight - descent is cut off at the top.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { displayFaces, displayName, nameStyle, type, type DisplayFace } from '../../constants/tokens';

// Per em, from the bundled @expo-google-fonts files: hhea descent and the
// tallest lowercase ascender (d, h, k, l, f). Accented capitals still reach
// higher. ponytail: they can clip on a one-line display name; the full font
// line height (1.3 em) would fix that at the cost of airy multi-line titles.
const METRICS: Record<keyof typeof displayFaces, { descent: number; ascender: number }> = {
  // Redaction from assets/fonts/redaction (italic 0.717).
  redaction: { descent: 0.3, ascender: 0.725 },
  // The rest measured with fontTools; ascender is the tallest of d h k l f b and
  // the capitals A H E I T (Belleza and Big Shoulders are set in capitals), italic included.
  newsreader: { descent: 0.265, ascender: 0.715 },
  fell: { descent: 0.363, ascender: 0.752 },
  imbue: { descent: 0.25, ascender: 0.755 },
  besley: { descent: 0.425, ascender: 0.791 },
  bricolage: { descent: 0.27, ascender: 0.712 },
  belleza: { descent: 0.224, ascender: 0.692 },
  shoulders: { descent: 0.214, ascender: 0.81 },
};

// Display and title, plus the sizes names are set at in the display face:
// headlines (rows, tiles) and the menu row and card names. Display, title,
// row and card set the face through nameStyle, at its scale; headline-sized
// names take the face as it comes.
const SIZES = { display: type.display, title: type.title, headline: type.headline, row: displayName.row, card: displayName.card };

for (const [variant, size] of Object.entries(SIZES)) {
  for (const [face, m] of Object.entries(METRICS)) {
    const { fontSize, lineHeight } = variant === 'headline' ? size : (nameStyle(face as DisplayFace, size) as typeof size);
    const room = lineHeight - m.descent * fontSize - m.ascender * fontSize;
    assert.ok(room >= 1, `${variant} in ${face}: ascenders clip on iOS (${room.toFixed(1)}pt of room above them)`);
  }
}

console.log('displayClip: display-face ascenders fit their line on iOS');
