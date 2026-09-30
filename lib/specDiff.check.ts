// Checks for lib/specDiff.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { specDiff, type Snapshot, type SnapshotLine } from './specDiff';

const line = (id: string, name: string | null, amount: number | string | null, unit: string | null, extra: Partial<SnapshotLine> = {}): SnapshotLine => ({
  ingredient_item_id: id,
  name,
  amount,
  unit,
  note: null,
  optional: false,
  at_service: null,
  ...extra,
});
const snap = (lines: SnapshotLine[], extra: Partial<Snapshot> = {}): Snapshot => ({
  lines,
  methods: ['Stir'],
  glass: 'Rocks',
  ice: 'Cubes',
  notes: null,
  dilution_pct: null,
  service_style: null,
  ...extra,
});

// The study's Brown Butter Old Fashioned: demerara 7.5 → 6 g, plus a dash of saline.
const v3 = snap([line('b', 'Butter-washed bourbon', 60, 'ml'), line('d', 'Demerara syrup', 7.5, 'g'), line('bt', 'Angostura', 2, 'dash')]);
const v4 = snap([line('b', 'Butter-washed bourbon', 60, 'ml'), line('d', 'Demerara syrup', 6, 'g'), line('bt', 'Angostura', 2, 'dash'), line('s', 'Saline', 1, 'dash')]);
assert.deepEqual(specDiff(v3, v4), ['Demerara syrup 7.5 g → 6 g', '+ 1 dash Saline']);
assert.deepEqual(specDiff(v4, v3), ['Demerara syrup 6 g → 7.5 g', '− Saline']);
assert.deepEqual(specDiff(v4, v4), [], 'nothing changed');

// Notes, optional, method, glass, ice, bartender notes, dilution, service style.
const v5 = snap([line('b', 'Butter-washed bourbon', 60, 'ml', { note: 'Wash overnight' }), line('d', 'Demerara syrup', 6, 'g', { optional: true }), line('bt', 'Angostura', 2, 'dash'), line('s', 'Saline', 1, 'dash')], {
  methods: ['Shake'],
  glass: 'Coupe',
  ice: null,
  notes: 'Serve very cold.',
  dilution_pct: 18,
  service_style: 'batched',
});
assert.deepEqual(specDiff(v4, v5), [
  'Butter-washed bourbon: prep note changed',
  'Demerara syrup now optional',
  'Method Stir → Shake',
  'Glass Rocks → Coupe',
  'Ice Cubes → none',
  'Bartender notes changed',
  'Dilution default → 18',
  'Service unset → batched',
]);

// Amounts as strings (numeric comes back as text from the API), missing names, and the first version.
assert.deepEqual(specDiff(snap([line('x', 'Gin', '60.000', 'ml')]), snap([line('x', 'Gin', 45, 'ml')])), ['Gin 60 ml → 45 ml']);
assert.deepEqual(specDiff(snap([line('x', 'Gin', null, null)]), snap([line('x', 'Gin', 45, 'ml')])), ['Gin no amount → 45 ml']);
assert.deepEqual(specDiff(null, snap([line('x', 'Gin', 45, 'ml'), line('y', null, 1, 'twist')])), ['+ 45 ml Gin', '+ 1 twist Hidden ingredient']);

console.log('specDiff: ok');
