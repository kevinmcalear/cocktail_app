import assert from 'node:assert/strict';

import { changeReason, type ChangeLine } from './prepChange';

const sugar: ChangeLine = { ingredientId: 's', name: 'White sugar', amount: 1000, unit: 'g' };
const water: ChangeLine = { ingredientId: 'w', name: 'Water', amount: 500, unit: 'ml' };

assert.equal(changeReason([sugar, water], [sugar, water]), null);
assert.equal(changeReason([sugar, water], [sugar, { ...water, amount: 450 }]), 'Less water, 450 ml instead of 500 ml, so every one of them would taste a little different.');
assert.equal(changeReason([sugar, water], [sugar, { ...water, amount: 600 }]), 'More water, 600 ml instead of 500 ml, so every one of them would taste a little different.');
assert.equal(changeReason([sugar, water], [sugar, { ...water, amount: 1, unit: 'cup' }]), 'A new amount of water, 1 cup instead of 500 ml, so every one of them would taste a little different.');
assert.equal(changeReason([sugar], [sugar, water]), 'Adding water changes it, so every one of them would taste a little different.');
assert.equal(changeReason([sugar, water], [sugar]), 'Taking out water changes it, so every one of them would taste a little different.');
assert.equal(changeReason([sugar, water], [{ ...sugar, amount: 900 }, { ...water, amount: 450 }]), 'The recipe changes in 2 places, so every one of them would taste a little different.');
console.log('prepChange ok');
