import { test } from 'node:test';
import assert from 'node:assert/strict';

import { migrationProblems } from '../migration-order.mjs';

// What main has: production applies these in order.
const main = ['20261010700000_profile_identity.sql', '20261010800000_menu_kind.sql'];

test('a new migration after main\'s latest is fine', () => {
  assert.deepEqual(migrationProblems(main, [...main, '20261010900000_spec_match.sql']), []);
});

test('a new migration at or below main\'s latest is refused, naming the number to beat', () => {
  const [below] = migrationProblems(main, [...main, '20261010720000_ingredient_tree_fill.sql']);
  assert.match(below, /20261010720000_ingredient_tree_fill\.sql is numbered at or below main's latest \(20261010800000\)/);
  assert.equal(migrationProblems(main, [...main, '20261010800000_catalog_facts.sql']).length, 2, 'same number as main: below, and a duplicate');
});

test('two files with one number are refused', () => {
  const problems = migrationProblems(main, [...main, '20261010900000_spec_match.sql', '20261010900000_vermouth.sql']);
  assert.deepEqual(problems, ['20261010900000_spec_match.sql and 20261010900000_vermouth.sql share the number 20261010900000; renumber one.']);
});

test('main\'s own files and other files in the folder pass', () => {
  assert.deepEqual(migrationProblems(main, main), []);
  assert.deepEqual(migrationProblems(main, [...main, '.gitkeep', 'README.md']), []);
});

test('a .sql file without a version is refused', () => {
  assert.deepEqual(migrationProblems(main, [...main, 'fix_things.sql']), ['fix_things.sql: name it <14-digit version>_<name>.sql.']);
});
