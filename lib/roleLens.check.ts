// Checks for lib/roleLens.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { defaultColumns, LENS_GROUPS, lensValue, ROLE_ADDS, roleSees, viewAsChoices } from './roleLens';
import type { MatrixColumn } from './roleMatrix';

// A Bartender looks as themselves or any role below; an Admin as all five.
assert.deepEqual(viewAsChoices(30).map((c) => c.label), ['Guest', 'Employee', 'Bartender']);
assert.equal(viewAsChoices(40).length, 5);
assert.ok(viewAsChoices(40).every((c) => c.adds), 'every role says what it adds');
// View as's one line: what the picked role sees.
assert.equal(roleSees('Admin', ROLE_ADDS[40]), 'Admin sees everything, including publishing.');
assert.equal(roleSees('Bartender', ROLE_ADDS[30]), 'Bartender adds the spec, method, batch and spec changes.');

const rows = LENS_GROUPS.flatMap((g) => g.rows);
const row = (id: string) => rows.find((r) => r.id === id)!;

// Cost and margin opens at Drink Creator (decision b48); every section names a real level.
assert.equal(row('costs').opensAt, 35);
assert.ok(rows.every((r) => r.opensAt in ROLE_ADDS));

// Without the venue's matrix, the base levels open each section at its default level.
const base = defaultColumns();
const level = (n: number) => base.find((c) => c.base_level === n)!;
assert.deepEqual(base.map((c) => c.base_level), [10, 20, 30, 35, 40]);
assert.equal(lensValue(base, level(20), row('spec')).can, false);
assert.equal(lensValue(base, level(30), row('spec')).can, true);
assert.equal(lensValue(base, level(10), row('backstory')).can, true);
assert.equal(lensValue(base, level(35), row('publish')).can, false);

// A venue that shows specs from Employee: its matrix says so, and the lens follows.
const venue: MatrixColumn[] = base.map((c) => (c.base_level === 20 ? { ...c, capabilities: [...c.capabilities, 'specs'] } : c));
assert.equal(lensValue(venue, venue[1], row('method')).can, true);

// A venue role that takes photos away from Bartender is marked as changed.
const guestBartender: MatrixColumn = { ...level(30), role_id: 'gb', name: 'Guest bartender', revoked: ['photos'], capabilities: level(30).capabilities.filter((c) => c !== 'photos') };
assert.deepEqual(lensValue([...base, guestBartender], guestBartender, row('photos')), { can: false, changed: true });
assert.deepEqual(lensValue([...base, guestBartender], guestBartender, row('spec')), { can: true, changed: false });
