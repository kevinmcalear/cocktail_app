import assert from 'node:assert/strict';

import { closeClassics, closestClassic, withArticle } from './closestClassic';

const MEZCAL = { id: 'mezcal', generic: 'agave' };
const TEQUILA = { id: 'tequila', generic: 'agave' };
const LIME = { id: 'lime', generic: 'citrus' };
const i = (id: string) => ({ id });
const SPECS = [
  { id: 'mm', name: 'Mezcal Margarita', ingredients: [MEZCAL, LIME, i('triple')] },
  { id: 'm', name: 'Margarita', ingredients: [TEQUILA, LIME, i('triple')] },
  { id: 'nk', name: 'Naked and Famous', ingredients: [MEZCAL, LIME, i('aperol'), i('chartreuse')] },
];

// The same bottles beat the same kind of bottle; the shorter classic wins a tie.
assert.equal(closestClassic([MEZCAL, LIME], SPECS)?.id, 'mm');
assert.equal(closestClassic([TEQUILA, LIME], SPECS)?.id, 'm');
// A brand line counts half through its generic: Del Maguey and lime is still close to a Mezcal Margarita.
assert.equal(closestClassic([{ id: 'del-maguey', generic: 'agave' }, LIME, i('triple')], SPECS.slice(0, 1))?.id, 'mm');
// One ingredient, or nothing close, says nothing.
assert.equal(closestClassic([MEZCAL], SPECS), null);
assert.equal(closestClassic([i('gin'), LIME, i('mint'), i('soda'), i('sugar')], SPECS), null);
// Far apart once the spec grows: two of five.
assert.equal(closestClassic([MEZCAL, LIME, i('shrub'), i('aquafaba')], SPECS.slice(0, 1)), null);

assert.equal(withArticle('Mezcal Margarita'), 'a Mezcal Margarita');
assert.equal(withArticle('Old Fashioned'), 'an Old Fashioned');

// The riff cards: the most shared first, each with the lines it shares; nothing shared, no card.
const cards = closeClassics([MEZCAL, LIME, i('aperol')], [...SPECS, { id: 'd', name: 'Daiquiri', ingredients: [i('rum'), LIME, i('sugar')] }, { id: 'g', name: 'Gimlet', ingredients: [i('gin'), i('cordial')] }]);
assert.deepEqual(
  cards.map((c) => c.spec.id),
  ['nk', 'mm', 'm', 'd']
);
assert.deepEqual(
  cards[0].lines.map((l) => l.id),
  ['mezcal', 'lime', 'aperol']
);
// Tequila counts through its generic (agave), so the Margarita shares it.
assert.deepEqual(
  cards[2].lines.map((l) => l.id),
  ['tequila', 'lime']
);
assert.equal(closeClassics([MEZCAL, LIME], SPECS, 2).length, 2);
// Two lines of one kind: only the one shared is named.
assert.deepEqual(
  closeClassics([MEZCAL, LIME], [{ id: 'x', name: 'Two Agaves', ingredients: [MEZCAL, TEQUILA, LIME] }])[0].lines.map((l) => l.id),
  ['mezcal', 'lime']
);
// Gin (a kind of spirit) names the classic's London dry gin, not its rum (another spirit).
assert.deepEqual(
  closeClassics([{ id: 'gin', generic: 'spirit' }, LIME], [{ id: 'f', name: 'Fairbanks', ingredients: [{ id: 'rum', generic: 'spirit' }, { id: 'ldg', generic: 'gin' }, LIME] }])[0].lines.map((l) => l.id),
  ['ldg', 'lime']
);
