import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { effectiveRole, roleLabel, ROLE_LEVELS, viewAsOptions } from './roles';

const LEVELS = ROLE_LEVELS.map((r) => r.level);

test('role levels match the user_bars.role_level check in the latest migration', () => {
  const dir = join(__dirname, '../supabase/migrations');
  const sql = readdirSync(dir).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  const checks = [...sql.matchAll(/user_bars_role_level_check"\s*CHECK \("role_level" = ANY \(ARRAY\[([\d, ]+)\]/g)];
  expect(checks.length).toBeGreaterThan(0);
  expect(checks.at(-1)![1].split(',').map(Number)).toEqual(LEVELS);
});

test.each([
  [10, 'Guest'],
  [20, 'Employee'],
  [30, 'Bartender'],
  [35, 'Drink Creator'],
  [40, 'Admin'],
  [99, 'Level 99'],
])('roleLabel(%i) is %s', (level, label) => {
  expect(roleLabel(level)).toBe(label);
});

test.each([
  [10, []],
  [20, [10]],
  [30, [10, 20]],
  [35, [10, 20, 30]],
  [40, [10, 20, 30, 35]],
])('a level %i member can view as %j', (level, options) => {
  expect(viewAsOptions(level).map((r) => r.level)).toEqual(options);
});

test('view-as caps the real role and never elevates it', () => {
  for (const real of LEVELS) {
    expect(effectiveRole(real, null)).toBe(real);
    expect(effectiveRole(real, undefined)).toBe(real);
    for (const viewAs of LEVELS) {
      expect(effectiveRole(real, viewAs)).toBe(Math.min(real, viewAs));
    }
  }
});

test('a missing role is treated as Guest', () => {
  expect(effectiveRole(0, null)).toBe(10);
  expect(effectiveRole(0, 40)).toBe(10);
});
