// Checks for lib/prepCost.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { prepCostMinor } from './prepCost';

// --- a house prep being written costs itself from its parts (m08) ---
{
  const syrup = {
    kind: 'syrup', baseKey: 'w', baseAmount: 1000, steps: [], keepsHours: null, storage: '', leadMinutes: null, actions: [],
    lines: [
      { key: 'w', id: null, name: 'Water', parts: 1, unit: 'ml', amount: '', yieldPer: 1 },
      { key: 's', id: 'sugar', name: 'Sugar', parts: 1, unit: 'g', amount: '', yieldPer: 0.62 },
    ],
  } as unknown as Parameters<typeof prepCostMinor>[0];
  // 1 kg of sugar from a 2 kg bag at £3.00 is £1.50 a batch; the batch makes about 1,620 ml.
  const cost = prepCostMinor(syrup, { amount: 20, unit: 'ml' }, (part) => (part.id === 'sugar' ? { amount: 2, unit: 'kg', costMinor: 300 } : null));
  assert.equal(cost?.batchMinor, 150);
  assert.equal(cost?.pourMinor, 2, '20 ml of 1,620 ml at £1.50');
  assert.equal(prepCostMinor(syrup, { amount: 20, unit: 'ml' }, () => null), null, 'a part with no price: no cost yet');
}
{
  const shrub = { kind: 'shrub', baseKey: 'v', baseAmount: 500, steps: [], keepsHours: null, storage: '', leadMinutes: null, actions: [],
    lines: [{ key: 'v', id: 'vinegar', name: 'Vinegar', parts: null, unit: 'ml', amount: '', yieldPer: 1 }, { key: 's', id: 'sugar', name: 'Sugar', parts: null, unit: 'g', amount: '500', yieldPer: 0.62 }],
  } as unknown as Parameters<typeof prepCostMinor>[0];
  assert.equal(prepCostMinor(shrub, { amount: 20, unit: 'ml' }, () => ({ amount: 1, unit: 'kg', costMinor: 200 })), null, 'a part with no amount yet: no cost, not a low one');
}
console.log('prepCost: ok');
