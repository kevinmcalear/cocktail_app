import assert from 'node:assert/strict';

import { prepTones } from '../constants/tokens';

import { startPrep } from './prepKinds';
import { prepShares, prepTone } from './prepShares';

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

// A cold shrub: equal parts pineapple, sugar and vinegar, plus two chillies as a sliver.
const shrub = startPrep('shrub', 'Pineapple chili shrub');
shrub.lines = shrub.lines.map((l) => (l.parts === null ? { ...l, amount: '2', unit: 'each' } : l));
const shares = prepShares(shrub);
assert.equal(shares.length, 4, 'every line is drawn');
assert.ok(near(shares.reduce((s, r) => s + r.share, 0), 1), 'the shares fill the bar');
assert.ok(near(shares[0].share, shares[1].share) && near(shares[1].share, shares[2].share), 'equal parts are equal');
assert.ok(shares[3].share >= 0.03 && shares[3].share < 0.06, 'the chillies are a sliver');

// The board's tones: yellow pineapple, white sugar, tan vinegar, red chilli.
assert.deepEqual(
  shares.map((s) => s.hex),
  [prepTones.yellow, prepTones.paper, prepTones.tan, prepTones.red],
  'the shrub draws yellow, white, tan, red',
);

// Chilli to taste, with no amount yet, still shows as a sliver.
const blank = startPrep('shrub', 'Pineapple chili shrub');
const blankShares = prepShares(blank);
assert.equal(blankShares.length, 4);
assert.equal(blankShares[3].hex, prepTones.red);

// A fat wash: the rum white, the coconut oil tan.
assert.equal(prepTone('Bacardí Carta Blanca'), prepTones.paper);
assert.equal(prepTone('Coconut Oil'), prepTones.tan);
assert.equal(prepTone('White rum'), prepTones.paper);
// A green liqueur keeps its own colour rather than snapping to a tone it isn't.
assert.equal(prepTone('Crème de menthe'), '#2FA552');
