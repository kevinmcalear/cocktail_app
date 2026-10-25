import assert from 'node:assert/strict';

import { aboutMl, inches, ounces, readSize } from './drawGlass';

// The hints under the number, as the board writes them.
assert.equal(inches(150), '5.9 in.');
assert.equal(ounces(200), '6¾ oz');
assert.equal(ounces(30), '1 oz');
assert.equal(ounces(15), '½ oz');
assert.equal(aboutMl(207), 'about 205 ml');

// Only a number a glass could be.
assert.equal(readSize('height', '150'), 150);
assert.equal(readSize('height', '92,5'), 92.5, 'a comma for the decimal point');
assert.equal(readSize('height', '1500'), null);
assert.equal(readSize('capacity', ' 205 '), 205);
assert.equal(readSize('capacity', ''), null);
assert.equal(readSize('capacity', 'abc'), null);

console.log('drawGlass ok');
