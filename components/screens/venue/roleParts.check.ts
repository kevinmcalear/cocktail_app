import assert from 'node:assert/strict';

import type { RoleMatrixRow } from '@/hooks/useVenueRoles';
import { rolesListLine } from '@/lib/roleMatrix';

import { roleFromKey, roleKey, rolesInOrder } from './roleParts';

const col = (role_id: string | null, base_level: number, capabilities: string[], extra: Partial<{ name: string; ends_at: string; granted: string[]; revoked: string[] }> = {}): RoleMatrixRow => ({
  role_id, name: extra.name ?? null, base_level, ends_at: extra.ends_at ?? null, granted: extra.granted ?? [], revoked: extra.revoked ?? [], capabilities, drink_types: null,
});

const matrix = [
  col(null, 10, ['menu']),
  col(null, 20, ['menu', 'talking_points']),
  col(null, 30, ['menu', 'talking_points', 'specs', 'house_made', 'prep', 'photos']),
  col(null, 35, ['menu', 'talking_points', 'specs', 'house_made', 'prep', 'photos', 'edit_drinks']),
  col(null, 40, ['menu', 'talking_points', 'specs', 'house_made', 'prep', 'photos', 'edit_drinks', 'menus', 'publish', 'staff', 'brand', 'costs', 'locations']),
  col('hb', 30, ['menu', 'talking_points', 'specs', 'house_made', 'prep', 'photos', 'staff', 'publish', 'locations'], { name: 'Head bartender', granted: ['publish', 'staff'] }),
  col('tk', 30, ['menu', 'specs', 'locations'], { name: 'Takeover bartender', ends_at: '2026-11-08T05:00:00Z', revoked: ['talking_points', 'house_made', 'prep', 'photos'] }),
];

// The board's order: most first, Head bartender under Admin, the takeover last; Guest only while someone holds it.
const names = (list: RoleMatrixRow[]) => list.map((r) => r.name ?? String(r.base_level));
assert.deepEqual(names(rolesInOrder(matrix, [])), ['40', 'Head bartender', '35', '30', '20', 'Takeover bartender']);
assert.deepEqual(names(rolesInOrder(matrix, [{ role_level: 10 }])).includes('10'), true);

assert.equal(roleKey(matrix[2]), 'level-30');
assert.equal(roleKey(matrix[5]), 'hb');
assert.equal(roleFromKey(matrix, 'level-30'), matrix[2]);
assert.equal(roleFromKey(matrix, 'hb'), matrix[5]);
assert.equal(roleFromKey(matrix, 'level-99'), null);

assert.equal(rolesListLine(matrix[4]), 'Everything, including the team and publishing');
assert.equal(rolesListLine({ ...matrix[2], granted: ['costs'] }), 'Menu, specs, house-made, prep, photos, changed here');
assert.equal(rolesListLine(matrix[5]), 'Bartender, plus publishing and the team');
assert.equal(rolesListLine(col('fl', 20, ['menu', 'talking_points'], { name: 'Floor' })), 'Same as Employee');
assert.match(rolesListLine(matrix[6]), /^Bartender, no talking points, house-made recipes, prep and photos, until \w{3} \d+ \w{3}$/);
