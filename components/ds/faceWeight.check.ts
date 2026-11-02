// Checks that a display face swapped into a system variant drops the variant's
// weight (Android measured "House drink" short and cut the last word).
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { displayFaces, faceWeightReset, fontFamilies, systemFont } from '../../constants/tokens';

for (const face of Object.values(displayFaces)) {
  assert.deepEqual(faceWeightReset(face.regular, undefined), { fontWeight: '400' }, face.label);
  assert.deepEqual(faceWeightReset(face.italic, undefined), { fontWeight: '400' }, `${face.label} italic`);
}
assert.deepEqual(faceWeightReset(fontFamilies.nameBold, undefined), { fontWeight: '400' });
// The system font keeps the variant's weight.
assert.equal(faceWeightReset(systemFont, undefined), undefined);
assert.equal(faceWeightReset(undefined, undefined), undefined);
// A caller that sets its own weight keeps it.
assert.equal(faceWeightReset(fontFamilies.name, '600'), undefined);

console.log('faceWeight ok');
