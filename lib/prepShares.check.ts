import assert from 'node:assert/strict';

import { startPrep } from './prepKinds';
import { prepShares } from './prepShares';

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

// A cold shrub: equal parts pineapple, sugar and vinegar, plus two chillies as a sliver.
const shrub = startPrep('shrub', 'Pineapple chili shrub');
shrub.lines = shrub.lines.map((l) => (l.parts === null ? { ...l, amount: '2', unit: 'each' } : l));
const shares = prepShares(shrub);
assert.equal(shares.length, 4, 'every line with an amount is drawn');
assert.ok(near(shares.reduce((s, r) => s + r.share, 0), 1), 'the shares fill the bar');
assert.ok(near(shares[0].share, shares[1].share) && near(shares[1].share, shares[2].share), 'equal parts are equal');
assert.ok(shares[3].share >= 0.019 && shares[3].share < 0.05, 'the chillies are a sliver');
assert.ok(shares[0].hex && shares[3].hex, 'pineapple and chilli have colours');

// A line with no amount yet is left out until it has one.
const blank = startPrep('shrub', 'Pineapple chili shrub');
assert.equal(prepShares(blank).length, 3);
