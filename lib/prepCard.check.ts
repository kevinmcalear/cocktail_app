import assert from 'node:assert/strict';

import { prepCardText } from './prepCard';

assert.equal(
  prepCardText({
    name: 'Rich Simple Syrup',
    facts: [{ label: 'Makes', value: '1.1 L' }, { label: 'Keeps', value: '8 weeks' }],
    lines: [{ amount: '1000 g', name: 'White sugar' }, { amount: '', name: 'Water, to cover' }],
    steps: ['Combine in a pan.', 'Stir until clear.'],
  }),
  'RICH SIMPLE SYRUP\nMakes 1.1 L · Keeps 8 weeks\n\n1000 g  White sugar\nWater, to cover\n\n1. Combine in a pan.\n2. Stir until clear.',
);
assert.equal(prepCardText({ name: 'Saline', facts: [], lines: [], steps: [] }), 'SALINE');
console.log('prepCard checks passed');
