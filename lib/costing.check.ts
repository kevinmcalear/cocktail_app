// Checks for lib/costing.ts. Run: npm run test:unit
// The example is the Ethyl study's: £12.00 on the menu, £1.90 to make, 20% VAT.
import assert from 'node:assert/strict';

import { exTax, formatPct, margin, priceForTarget, targetStatus } from './costing';

const uk = { taxRate: 20, pricesIncludeTax: true };
const us = { taxRate: 8.875, pricesIncludeTax: false };

assert.equal(exTax(1200, uk), 1000);
assert.equal(exTax(1200, us), 1200, 'tax added at the till leaves the menu price alone');

const m = margin(190, 1200, uk)!;
assert.equal(m.exTaxMinor, 1000);
assert.equal(m.gp.toFixed(1), '81.0');
assert.equal(m.pourCost.toFixed(1), '19.0');
assert.equal(margin(190, null, uk), null);
assert.equal(margin(190, 0, uk), null);
assert.equal(margin(190, 1200, us)!.gp.toFixed(1), '84.2');

// 82% GP on £1.90 needs £10.56 ex VAT, £12.67 on the menu, rounded up to £12.70.
assert.equal(priceForTarget(190, 82, uk), 1270);
assert.equal(priceForTarget(190, 82, us), 1060);
assert.equal(priceForTarget(190, 100, uk), null);
assert.equal(priceForTarget(0, 80, uk), 0);

assert.deepEqual(targetStatus(190, 1200, 80, uk), { onTarget: true });
assert.deepEqual(targetStatus(190, 1200, 82, uk), { onTarget: false, priceMinor: 1270 });
assert.deepEqual(targetStatus(190, null, 82, uk), { onTarget: false, priceMinor: 1270 }, 'no price yet: say what it would take');
assert.equal(targetStatus(190, 1200, null, uk), null);
assert.equal(formatPct(81.04), '81.0%');

console.log('costing: ok');
