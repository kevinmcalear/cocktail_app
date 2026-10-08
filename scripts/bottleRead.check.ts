import assert from 'node:assert/strict';

import { cleanAbv, cleanBottlesReading, MOCK_BOTTLE_REPLY } from '../supabase/functions/_shared/bottleRead';

// read-bottle (supabase/functions/read-bottle) must hand the app a reading it
// can trust, whatever the model sends back.

assert.equal(cleanAbv(43.1), 43.1);
assert.equal(cleanAbv('40 % vol'), 40);
assert.equal(cleanAbv('16,5%'), 16.5);
assert.equal(cleanAbv(0), null);
assert.equal(cleanAbv(140), null);
assert.equal(cleanAbv('strong'), null);
assert.equal(cleanAbv(null), null);

assert.deepEqual(
  cleanBottlesReading({
    bottles: [
      { brand: ' Tanqueray ', name: 'Tanqueray\nNo. Ten', kind: 'London dry gin', abv: '47.3%' },
      { brand: 'Tanqueray', name: 'tanqueray no. ten', kind: null, abv: null },
      { brand: '', name: '', kind: 'Gin' },
      { name: 'Campari', abv: 'n/a' },
      'junk',
    ],
  }),
  {
    bottles: [
      { brand: 'Tanqueray', name: 'Tanqueray No. Ten', kind: 'London dry gin', abv: 47.3 },
      { brand: null, name: 'Campari', kind: null, abv: null },
    ],
  }
);
assert.equal(cleanBottlesReading({ bottles: Array.from({ length: 20 }, (_, i) => ({ name: `Bottle ${i}` })) }).bottles.length, 12);
assert.deepEqual(cleanBottlesReading(null), { bottles: [] });
assert.equal(cleanBottlesReading(MOCK_BOTTLE_REPLY).bottles.length, 3);

console.log('bottleRead: ok');
