// Checks for lib/costing.ts. Run: npm run test:unit
// The example is the Ethyl study's: £12.00 on the menu, £1.90 to make, 20% VAT.
import assert from 'node:assert/strict';

import { exTax, formatPct, lineCostMinor, margin, menuSummary, priceForProfit, priceForTarget, targetsLine, targetStatus, underLabel } from './costing';

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

assert.equal(m.profitMinor, 810, '£10.00 ex VAT less £1.90');

// At least £9.00 a drink on £1.90: £10.90 ex VAT, £13.08 on the menu, so £13.10.
assert.equal(priceForProfit(190, 900, uk), 1310);
assert.equal(priceForProfit(190, 900, us), 1090);
assert.equal(priceForProfit(190, -1, uk), null);
// Clean figures stay put: AUD 5.80 at 78% GP with 10% GST is exactly 29.00.
assert.equal(priceForTarget(580, 78, { taxRate: 10, pricesIncludeTax: true }), 2900);

const gpOnly = (gp: number | null) => ({ gp, minProfitMinor: null });
assert.deepEqual(targetStatus(190, 1200, gpOnly(80), uk), { onTarget: true });
assert.deepEqual(targetStatus(190, 1200, gpOnly(82), uk), { onTarget: false, priceMinor: 1270, under: 'gp' });
assert.deepEqual(targetStatus(190, null, gpOnly(82), uk), { onTarget: false, priceMinor: 1270, under: 'gp' }, 'no price yet: say what it would take');
assert.equal(targetStatus(190, 1200, gpOnly(null), uk), null);
// A cheap drink at 81% GP that makes only £8.10: under the £9 floor, and £13.10 clears both.
assert.deepEqual(targetStatus(190, 1200, { gp: 80, minProfitMinor: 900 }, uk), { onTarget: false, priceMinor: 1310, under: 'profit' });
assert.deepEqual(targetStatus(190, 1200, { gp: 82, minProfitMinor: 900 }, uk), { onTarget: false, priceMinor: 1310, under: 'both' }, 'the higher price clears both');
assert.deepEqual(targetStatus(190, 1400, { gp: 80, minProfitMinor: 900 }, uk), { onTarget: true });
assert.deepEqual(targetStatus(190, null, { gp: null, minProfitMinor: 900 }, uk), { onTarget: false, priceMinor: 1310, under: 'profit' });
assert.equal(formatPct(81.04), '81.0%');

// A menu: two priced and on target, one under, one with no price yet, one incomplete.
const summary = menuSummary(
  [
    { costMinor: 190, priceMinor: 1200, missing: 0 },
    { costMinor: 172, priceMinor: 1300, missing: 0 },
    { costMinor: 291, priceMinor: 1400, missing: 0 },
    { costMinor: 138, priceMinor: null, missing: 0 },
    { costMinor: 240, priceMinor: 1200, missing: 1 },
  ],
  gpOnly(82),
  uk
);
assert.equal(summary.priced, 4);
assert.equal(summary.averageGp!.toFixed(1), '79.0');
assert.equal(summary.underTarget, 3, 'the mai tai at 75.1%, the incomplete one at 76%, and 81.0% is under 82 too');
assert.equal(summary.incomplete, 1);
assert.equal(menuSummary([], gpOnly(82), uk).averageGp, null);
assert.equal(menuSummary([], gpOnly(82), uk).averageProfitMinor, null);
assert.equal(menuSummary([{ costMinor: 190, priceMinor: 1200, missing: 0 }], gpOnly(null), uk).underTarget, 0);
// On GP alone the £12 drink passes 80%; a £9 floor catches it.
const floor = menuSummary([{ costMinor: 190, priceMinor: 1200, missing: 0 }, { costMinor: 190, priceMinor: 1500, missing: 0 }], { gp: 80, minProfitMinor: 900 }, uk);
assert.equal(floor.underTarget, 1);
assert.equal(floor.averageProfitMinor, (810 + 1060) / 2);


const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;
assert.equal(targetsLine({ gp: 78, minProfitMinor: 1100 }, usd), '78% GP and at least $11.00 a drink');
assert.equal(targetsLine({ gp: null, minProfitMinor: 1100 }, usd), 'at least $11.00 a drink');
assert.equal(targetsLine({ gp: null, minProfitMinor: null }, usd), null);
assert.equal(underLabel('gp', { gp: 78, minProfitMinor: 1100 }, usd), 'Under 78% GP');
assert.equal(underLabel('profit', { gp: 78, minProfitMinor: 1100 }, usd), 'Makes under $11.00');
assert.equal(underLabel('both', { gp: 78, minProfitMinor: 1100 }, usd), 'Under both targets');

console.log('costing: ok');

// A line's cost from the pack: 30 ml of a 750 ml bottle at 32.00 is 1.28.
assert.equal(lineCostMinor(30, 'ml', { amount: 750, unit: 'ml', costMinor: 3200 }, 1), 128);
assert.equal(lineCostMinor(1, 'oz', { amount: 1, unit: 'l', costMinor: 1000 }, 1), 30);
assert.equal(lineCostMinor(20, 'g', { amount: 1, unit: 'kg', costMinor: 500 }, 1), 10, 'weights meet weights');
assert.equal(lineCostMinor(15, 'ml', { amount: 1, unit: 'kg', costMinor: 400 }, 1.23), 7, 'a syrup by the kilo through its density');
assert.equal(lineCostMinor(1, 'each', { amount: 12, unit: 'each', costMinor: 600 }, 1), 50);
assert.equal(lineCostMinor(1, 'wedge', { amount: 12, unit: 'each', costMinor: 600 }, 1), 50, 'any count is one of the pack');
assert.equal(lineCostMinor(1, 'wedge', { amount: 750, unit: 'ml', costMinor: 600 }, 1), null, 'a count never meets a bottle');
assert.equal(lineCostMinor(null, 'top', { amount: 750, unit: 'ml', costMinor: 600 }, 1), null);
