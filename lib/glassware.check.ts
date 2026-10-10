import assert from 'node:assert/strict';

import { GLASS_TYPE_LABEL, GLASS_TYPES, glassFieldProblem, glassTitle, textOrNull } from './glassware';

const blank = { name: '', maker: '', designer: '', series: '', shape_note: '' };
assert.equal(glassFieldProblem(blank), null);
assert.deepEqual(glassFieldProblem({ ...blank, maker: 'x'.repeat(81) }), { field: 'maker', message: 'Keep it to 80 characters.' });
assert.equal(glassFieldProblem({ ...blank, maker: `  ${'x'.repeat(80)}  ` }), null, 'trimmed before counting');
assert.deepEqual(glassFieldProblem({ ...blank, shape_note: 'x'.repeat(501) })?.field, 'shape_note');
assert.equal(glassTitle({ name: '  ', glass: 'nick' }), 'Nick & Nora');
assert.equal(glassTitle({ name: 'Leopold coupe', glass: 'coupe' }), 'Leopold coupe');
assert.equal(textOrNull('  '), null);
assert.equal(textOrNull(' Kimura '), 'Kimura');
for (const g of GLASS_TYPES) assert.ok(GLASS_TYPE_LABEL[g], `a label for ${g}`);

console.log('glassware: ok');
