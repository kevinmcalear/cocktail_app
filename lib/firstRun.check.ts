import assert from 'node:assert/strict';

import { DIMENSIONS, type Profile } from './flavor';
import { flavourWords, methodWord, pairsFor, tasteFrom, tasteLine, type PickedDrink } from './firstRun';

const prof = (over: Partial<Profile>): Profile => Object.fromEntries(DIMENSIONS.map((d) => [d, over[d] ?? 0])) as Profile;

const negroni: PickedDrink = { id: 'negroni', method: 'stir', profile: prof({ bitter: 0.9, sweet: 0.5, strong: 0.8 }) };
const martini: PickedDrink = { id: 'martini', method: 'stir', profile: prof({ botanical: 0.8, strong: 0.9 }) };
const daiquiri: PickedDrink = { id: 'daiquiri', method: 'shake', profile: prof({ sour: 0.8, sweet: 0.4 }) };
const penicillin: PickedDrink = { id: 'penicillin', method: 'shake', profile: prof({ smoky: 0.5, sour: 0.6, spicy: 0.4 }) };
const spritz: PickedDrink = { id: 'spritz', method: 'build', profile: prof({ bitter: 0.5, fruity: 0.5 }) };
const five = [negroni, martini, daiquiri, penicillin, spritz];

// Three pairs, every drink asked about, stirred against shaken first.
const pairs = pairsFor(five);
assert.equal(pairs.length, 3);
assert.equal(new Set(pairs.flat()).size, 5, 'all five picks are in a pair');
for (const [a, b] of pairs) assert.notEqual(a, b);
const methods = new Map(five.map((p) => [p.id, p.method]));
assert.notEqual(methods.get(pairs[0][0]), methods.get(pairs[0][1]), 'the first pair is two ways of making a drink');

// Words on a pair card.
assert.equal(methodWord('stir'), 'Stirred');
assert.equal(methodWord('shake'), 'Shaken');
assert.equal(methodWord(null), null);
assert.equal(flavourWords(negroni.profile), 'Bitter, sweet', 'strength is not a flavour on the card');
assert.equal(flavourWords(null), null);

// The taste: picks once, winners twice more, only the quick questions' dimensions.
const taste = tasteFrom(five, ['negroni', 'negroni', 'spritz']);
assert.deepEqual(Object.keys(taste).sort(), ['bitter', 'creamy', 'smoky', 'sour', 'strong', 'sweet']);
assert.ok(taste.bitter! > taste.sour!, 'the drinks liked more pull the taste');
assert.deepEqual(tasteFrom([{ id: 'x', method: null, profile: null }], ['x']), {}, 'no profiles, no taste');

// The line: top flavour, and the method most winners share.
assert.equal(tasteLine(taste, ['stir', 'stir', 'build']), 'You like it bitter and stirred.');
assert.equal(tasteLine({ sour: 0.7, sweet: 0.4 }, ['shake', 'stir']), 'You like it sour and sweet.', 'no method most share: the second flavour');
assert.equal(tasteLine({ sour: 0.7 }, []), 'You like it sour.');
assert.equal(tasteLine({}, []), null);

console.log('firstRun ok');
