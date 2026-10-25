// Checks for lib/makeItHouse.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { houseName, houseNudge, houseWord } from './makeItHouse';
import { nameFor } from './techniques/template';

// The drink's name says it: the rum line is the one to wash, with coconut.
const lines = [
  { key: 'a', id: 'bacardi', name: 'Bacardí Carta Blanca', styleName: 'White Rum' },
  { key: 'b', id: 'lime', name: 'Lime juice' },
];
const nudge = houseNudge('Coconut Fat-Washed Daiquiri', lines);
assert.ok(nudge, 'the name nudges');
assert.equal(nudge.key, 'a');
assert.equal(nudge.technique.id, 'fat-wash');
assert.equal(nudge.adjunct, 'Coconut');
assert.equal(nudge.phrase, 'coconut fat-washed');
assert.equal(nameFor(nudge.technique, { base: 'Bacardí Carta Blanca', adjunct: nudge.adjunct }), 'Coconut fat-washed Bacardí Carta Blanca', 'flavour, technique, exact bottle');

assert.equal(houseNudge('Daiquiri', lines), null, 'an ordinary name says nothing');
assert.equal(houseNudge('Coconut Fat-Washed Daiquiri', [{ ...lines[0], prep: {} }, lines[1]]), null, 'once a line is house-made, no nudge');
assert.equal(houseNudge('Coconut Fat-Washed Daiquiri', [lines[1]]), null, 'no spirit line, nothing to wash');
assert.equal(houseNudge('Coconut Fat-Washed Daiquiri', [{ key: 'c', id: null, name: 'White rum' }]), null, 'a line not yet in the catalog is made in house from the search instead');

// A line that says it's made here: Make it in-house first, and the recipe named without the word.
assert.equal(houseWord('house miso banana liqueur'), 'house');
assert.equal(houseWord('Homemade grenadine'), 'homemade');
assert.equal(houseWord('in-house orgeat'), 'in-house');
assert.equal(houseWord('Miso banana liqueur'), null, 'no "house", a bottle we buy comes first');
assert.equal(houseWord('Householder gin'), null, 'a whole word only');
assert.equal(houseName('house miso banana liqueur'), 'Miso banana liqueur');
assert.equal(houseName('Our house-made falernum'), 'Falernum');
assert.equal(houseName('Orgeat (house-made)'), 'Orgeat');
assert.equal(houseName('orgeat (house)'), 'Orgeat');
assert.equal(houseName('Falernum, house-made'), 'Falernum');
assert.equal(houseName('Pale ale house'), 'Pale ale house', 'a bare "house" at the end is part of the name');
assert.equal(houseName('Homemade grenadine'), 'Grenadine');
assert.equal(houseName('mezcal'), 'Mezcal', 'nothing to take out');
assert.equal(houseName('House'), 'House', 'only the word: kept');

console.log('makeItHouse.check: ok');
