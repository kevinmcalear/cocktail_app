// Checks for lib/glassKinds.ts (owner-setup step 6). Run: npm run test:unit
import assert from 'node:assert/strict';

import { anyLine, kindOf, kindRow, SETUP_KINDS } from './glassKinds';
import { variantsOf } from './sketch/geometry';

const k = (key: string) => SETUP_KINDS.find((x) => x.key === key)!;

// The board's eleven kinds, each a drawing the database accepts.
assert.deepEqual(
  SETUP_KINDS.map((x) => x.label),
  ['Coupe', 'Nick & Nora', 'Martini', 'Rocks', 'Double rocks', 'Highball', 'Collins', 'Flute', 'Wine', 'Tiki mug', 'Copper mug']
);
assert.equal(new Set(SETUP_KINDS.map((x) => x.key)).size, SETUP_KINDS.length, 'keys are unique');
for (const x of SETUP_KINDS) if (x.variant) assert.ok(variantsOf(x.glass).some((v) => v.key === x.variant), `${x.label} is a real drawing`);

// A glass sits under its variant's kind, else its glass's plain kind.
assert.equal(kindOf({ glass: 'rocks', variant: 'rocks_double' })?.label, 'Double rocks');
assert.equal(kindOf({ glass: 'rocks', variant: null })?.label, 'Rocks');
assert.equal(kindOf({ glass: 'rocks', variant: 'rocks_heavy' })?.label, 'Rocks', 'another rocks drawing is still a rocks glass');
assert.equal(kindOf({ glass: 'mug', variant: 'mug_irish' }), null, 'a mug that is not copper: no kind tile');
assert.equal(kindOf({ glass: 'snifter', variant: null }), null);

// A kind on its own: no model, the variant's name kept, first of its glass the main one.
assert.deepEqual(kindRow(k('coupe'), []), {
  glass: 'coupe',
  variant: null,
  name: null,
  maker: null,
  maker_profile_id: null,
  designer: null,
  series: null,
  shape_note: null,
  model_id: null,
  is_default: true,
});
const double = kindRow(k('rocks_double'), [{ glass: 'rocks', is_default: true }]);
assert.equal(double.name, 'Double rocks');
assert.equal(double.variant, 'rocks_double');
assert.equal(double.is_default, false, 'Rocks is already the main rocks glass');
assert.equal(kindRow(k('rocks'), [{ glass: 'rocks', is_default: false }, { glass: 'coupe', is_default: true }]).is_default, true);

// How the list says it.
assert.equal(anyLine({ glass: 'coupe', variant: null }), 'Any coupe');
assert.equal(anyLine({ glass: 'rocks', variant: 'rocks_double' }), 'Any double rocks glass');
assert.equal(anyLine({ glass: 'snifter', variant: null }), 'Any snifter');
