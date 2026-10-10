import assert from 'node:assert/strict';

import { closestClassic, withArticle } from './closestClassic';

const SPECS = [
  { id: 'mm', name: 'Mezcal Margarita', ingredients: ['mezcal', 'lime', 'agave', 'triple'] },
  { id: 'ps', name: 'Paloma', ingredients: ['tequila', 'lime', 'grapefruit-soda'] },
  { id: 'nk', name: 'Naked and Famous', ingredients: ['mezcal', 'lime', 'aperol', 'chartreuse'] },
  { id: 'gimlet', name: 'Mezcal Gimlet', ingredients: ['mezcal', 'lime', 'cordial'] },
];

// Two of a short classic's three is closer than two of four.
assert.equal(closestClassic(['mezcal', 'lime'], SPECS)?.id, 'gimlet');
// Three shared of a four-line classic wins.
assert.equal(closestClassic(['mezcal', 'lime', 'agave'], SPECS)?.id, 'mm');
// One ingredient, or nothing close, says nothing.
assert.equal(closestClassic(['mezcal'], SPECS), null);
assert.equal(closestClassic(['gin', 'lime', 'mint', 'soda', 'sugar'], SPECS), null);
// Far apart once the spec grows: two of six.
assert.equal(closestClassic(['mezcal', 'lime', 'shrub', 'aquafaba'], SPECS.slice(0, 1)), null);

assert.equal(withArticle('Mezcal Margarita'), 'a Mezcal Margarita');
assert.equal(withArticle('Old Fashioned'), 'an Old Fashioned');
