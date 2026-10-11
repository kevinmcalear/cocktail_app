// Checks for lib/roleLens.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { DRINK_SECTIONS, lensCell, ROLE_ADDS, viewAsChoices } from './roleLens';

// A Bartender looks as themselves or any role below; an Admin as all five.
assert.deepEqual(viewAsChoices(30).map((c) => c.label), ['Guest', 'Employee', 'Bartender']);
assert.equal(viewAsChoices(40).length, 5);
assert.ok(viewAsChoices(40).every((c) => c.adds), 'every role says what it adds');

// The first role to open a section is marked; Guest's sections are just open.
assert.equal(lensCell(30, 30), 'first');
assert.equal(lensCell(30, 40), 'open');
assert.equal(lensCell(30, 20), 'lock');
assert.equal(lensCell(10, 10), 'open');

// Cost and margin opens at Drink Creator (decision b48); every section names a real level.
assert.equal(DRINK_SECTIONS.find((s) => s.name === 'Cost and margin')?.opensAt, 35);
assert.ok(DRINK_SECTIONS.every((s) => s.opensAt in ROLE_ADDS));
