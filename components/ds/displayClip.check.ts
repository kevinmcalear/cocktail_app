// Checks that display and title leave room above the ascenders on iOS. When a
// lineHeight is below the font's own line height (ascent + descent), React
// Native skips its centring offset (RCTAttributedTextUtils RCTApplyBaselineOffset)
// and TextKit sits the baseline one descent above the bottom of the line, so
// anything taller than lineHeight - descent is cut off at the top.
// Each face's descent and tallest ascender live with the face in
// constants/tokens.ts (displayFaces), measured with fontTools; nameStyle
// raises a name's line height from them.
// ponytail: accented capitals reach higher still (Imbue's Å is 0.85 em) and
// can clip on a one-line display name; measuring them into `ascender` would
// fix that at the cost of airier multi-line titles in every face.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { displayFaces, displayName, NAME_ROOM, nameStyle, type, type DisplayFace } from '../../constants/tokens';

// Display and title, plus the sizes names are set at in the display face:
// headlines (rows, tiles) and the menu row and card names. Display, title,
// row and card set the face through nameStyle, at its scale; headline-sized
// names take the face as it comes.
const SIZES = { display: type.display, head: type.head, listHead: type.listHead, title: type.title, headline: type.headline, row: displayName.row, card: displayName.card };

for (const [variant, size] of Object.entries(SIZES)) {
  for (const [face, m] of Object.entries(displayFaces)) {
    const { fontSize, lineHeight } = variant === 'headline' ? size : (nameStyle(face as DisplayFace, size) as typeof size);
    const room = lineHeight - m.descent * fontSize - m.ascender * fontSize;
    assert.ok(room >= NAME_ROOM, `${variant} in ${face}: ascenders clip on iOS (${room.toFixed(1)}pt of room above them)`);
  }
}

// Deco is drawn at 1.08 of the others (canvas Theme-faces). At the title's
// 38pt line its 37pt letters had 0.8pt of room, so its line grows by a point;
// every other face keeps the size's own line.
assert.equal(displayFaces.imbue.scale, 1.08);
assert.equal(nameStyle('imbue', type.title).lineHeight, 39);
assert.equal(nameStyle('instrument', type.title).lineHeight, type.title.lineHeight);
for (const face of Object.keys(displayFaces) as DisplayFace[]) {
  if (face !== 'imbue') assert.equal(nameStyle(face, type.title).lineHeight, type.title.lineHeight, `${face} keeps the title's line`);
}

console.log('displayClip: display-face ascenders fit their line on iOS');
