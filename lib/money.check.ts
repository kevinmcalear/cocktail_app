// Checks for lib/money.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { formatMoney, isCurrencyCode, minorPerMajor, moneyFieldValue, parseMoney } from './money';

assert.ok(isCurrencyCode('GBP') && !isCurrencyCode('gbp') && !isCurrencyCode('') && !isCurrencyCode(null));
assert.equal(minorPerMajor('GBP'), 100);
assert.equal(minorPerMajor('JPY'), 1);

// Formatting follows the runtime's locale, so check the parts that don't move.
assert.match(formatMoney(1200, 'GBP')!, /12\.00/);
assert.match(formatMoney(190, 'EUR')!, /1\.90/);
assert.match(formatMoney(1200, 'JPY')!, /1,?200/);
assert.equal(formatMoney(null, 'GBP'), null);
assert.equal(formatMoney(1200, null), null);
assert.equal(formatMoney(1200, 'nope'), null);

assert.equal(parseMoney('12', 'GBP'), 1200);
assert.equal(parseMoney('12.5', 'GBP'), 1250);
assert.equal(parseMoney('£12.50', 'GBP'), 1250);
assert.equal(parseMoney('1,200', 'JPY'), 1200);
assert.equal(parseMoney('', 'GBP'), null);
assert.equal(parseMoney('free', 'GBP'), null);
assert.equal(parseMoney('-3', 'GBP'), null);
assert.equal(parseMoney('0', 'GBP'), 0);

assert.equal(moneyFieldValue(1250, 'GBP'), '12.50');
assert.equal(moneyFieldValue(1200, 'JPY'), '1200');
assert.equal(moneyFieldValue(null, 'GBP'), '');

console.log('money: ok');
