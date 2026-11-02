// The amber triangle on an error toast reads at 3:1 or better against the pill it sits on, in both schemes.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { backbar, STATUS } from '../../constants/tokens.ts';
import { contrast, toastWarnInk } from '../../lib/color.ts';

for (const scheme of ['light', 'dark'] as const) {
  const { ink, pill } = toastWarnInk(STATUS.warning, backbar[scheme].raised, backbar[scheme].ground);
  const ratio = contrast(ink, pill);
  console.log(`${scheme}: ${ink} on ${pill} = ${ratio.toFixed(2)}:1`);
  assert.ok(ratio >= 3, `${scheme} error toast triangle is ${ratio.toFixed(2)}:1, needs 3:1`);
}
