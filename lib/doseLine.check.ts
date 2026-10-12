import assert from 'node:assert/strict';

import { doseLine } from './doseLine';

assert.equal(doseLine(['0.05 to 0.1%', '0.1%', '0.2%']), 'For 1 L of syrup that is 0.5 to 2 g. You need a 0.01 g scale.');
assert.equal(doseLine(['0.33% (1 g in 300 g 1:1 syrup)']), 'For 1 L of syrup that is 3.3 g.');
assert.equal(doseLine(['0.2% (2 g per kg)', '1%']), 'For 1 L of syrup that is 2 to 10 g.', 'a note after the share is ignored');
assert.equal(doseLine(['a pinch', 'to taste']), null);
assert.equal(doseLine([]), null);
console.log('doseLine checks passed');
