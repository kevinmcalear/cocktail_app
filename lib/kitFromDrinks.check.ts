import assert from 'node:assert/strict';

import { kitFromDrinks } from './kitFromDrinks';

const drinks = [
  { glass: 'Small Rocks', ice: ['Sphere'], methods: ['Stirred'] },
  { glass: 'Small Rocks', ice: ['Sphere'], methods: [] },
  { glass: 'Rocks', ice: [], methods: [] },
  { glass: 'Custom', ice: [], methods: [] },
  { glass: 'Coupe', ice: [], methods: ['Shaken'] },
  { glass: 'Flute', ice: [], methods: [] },
  { glass: 'Highball', ice: ['Cubes'], methods: ['Blended'] },
  { glass: null, ice: ['Large cube'], methods: [] },
];
const out = kitFromDrinks(drinks, {
  glasses: [
    { id: 'coupe', glass: 'coupe', name: null, model_id: 'm1' },
    { id: 'flute', glass: 'flute', name: null, model_id: null },
    { id: 'hb', glass: 'highball', name: null, model_id: 'm2' },
  ],
  ice: [
    { name: 'Cubes', shape: 'cubes', draw_as: null },
    { name: 'Clear cube · 50 mm', shape: 'large', draw_as: null },
    { name: 'Block', shape: 'block', draw_as: null },
  ],
  tools: ['ice-tools'],
  iceSteps: [{ ice: 'Clear cube · 50 mm', equipment: ['ice-tools', 'atomizer', 'not-a-tool'] }],
});

// Small Rocks and Rocks are one rocks glass the venue doesn't list; Flute is listed with no real glass; Coupe and Highball are matched; Custom isn't a shape.
assert.deepEqual(out.glasses, [
  { name: 'Small Rocks', glass: 'rocks', drinks: 3, match: null },
  { name: 'Flute', glass: 'flute', drinks: 1, match: 'flute' },
]);
// A large cube is covered by the clear cube (same drawing); a sphere isn't.
assert.deepEqual(out.ice, [{ name: 'Sphere', kind: 'sphere', drinks: 2 }]);
// Blended drinks want a blender; an ice recipe's tool the venue lacks is named once, ours only.
assert.deepEqual(out.tools, [
  { key: 'blender', why: '1 drink is blended' },
  { key: 'atomizer', why: 'Your Clear cube · 50 mm recipe uses it' },
]);
