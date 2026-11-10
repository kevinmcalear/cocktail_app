// The amber triangle on an error toast reads at 3:1 or better against the pill it sits on, in both schemes.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { backbar, STATUS } from '../../constants/tokens.ts';
import { contrast, toastWarnInk } from '../../lib/color.ts';

// The green tick on a success toast (Add-parts, 4) too.
for (const [tone, colour] of [['error', STATUS.warning], ['success', STATUS.success]] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    const { ink, pill } = toastWarnInk(colour, backbar[scheme].raised, backbar[scheme].ground);
    const ratio = contrast(ink, pill);
    console.log(`${tone} ${scheme}: ${ink} on ${pill} = ${ratio.toFixed(2)}:1`);
    assert.ok(ratio >= 3, `${scheme} ${tone} toast icon is ${ratio.toFixed(2)}:1, needs 3:1`);
  }
}
