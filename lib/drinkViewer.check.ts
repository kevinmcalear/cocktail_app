// Checks for lib/drinkViewer.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { drinkViewer, makesIt, namesOnly, onTeam } from './drinkViewer';

const base = { home: false, own: false, teamRole: null, canEdit: false, amounts: false };

// A guest at a bar: names only.
assert.equal(drinkViewer(base), 'guest');
// A classic or shared spec: Ingredients first.
assert.equal(drinkViewer({ ...base, amounts: true }), 'public');
// The bar's team by level: floor has no amounts, a bartender does, a creator may edit.
assert.equal(drinkViewer({ ...base, teamRole: 20 }), 'floor');
assert.equal(drinkViewer({ ...base, teamRole: 30, amounts: true }), 'bartender');
assert.equal(drinkViewer({ ...base, teamRole: 35, amounts: true, canEdit: true }), 'creator');
// Viewing as a floor role (amounts gone) never shows the creator's rows, even with edit rights.
assert.equal(drinkViewer({ ...base, teamRole: 20, canEdit: true }), 'floor');
// Home: your own drink is Steps; a classic is public.
assert.equal(drinkViewer({ ...base, home: true, own: true, amounts: true }), 'home');
assert.equal(drinkViewer({ ...base, home: true, amounts: true }), 'public');

assert.ok(makesIt('bartender') && makesIt('home') && !makesIt('public'));
assert.ok(onTeam('floor') && !onTeam('home'));
assert.ok(namesOnly('guest') && namesOnly('floor') && !namesOnly('public'));
