// Checks for lib/matchParts.ts and rankCaption in lib/ranking.ts (the rows' lit words and rank captions). Run: npm run test:unit
import assert from 'node:assert/strict';

import { matchParts } from './matchParts';
import { rankCaption } from './ranking';

const lit = (text: string, q: string) => matchParts(text, q).map((p) => (p.hit ? `[${p.text}]` : p.text)).join('');

assert.equal(lit('Plum Negroni', 'negroni'), 'Plum [Negroni]');
assert.equal(lit('Negroni Sour', 'NEGRONI'), '[Negroni] Sour');
assert.equal(lit('Riff on a Négroni', 'negroni'), 'Riff on a [Négroni]', 'accents fold');
assert.equal(lit('Rye Garden Highball', 'rye'), '[Rye] Garden Highball');
assert.equal(lit('Smoke & Fig Old Fashioned', 'old fashioned'), 'Smoke & Fig [Old] [Fashioned]', 'each word lights');
assert.equal(lit('Martini', 'martini'), '[Martini]');
assert.equal(lit('Gibson', 'martini'), 'Gibson');
assert.equal(lit('Gibson', ''), 'Gibson');
assert.equal(lit('Gin and tonic', 'a'), 'Gin and tonic', 'one letter lights nothing');
assert.deepEqual(matchParts('Gibson', 'martini'), [{ text: 'Gibson', hit: false }]);

assert.equal(rankCaption({ position: 2, of: 11, name: 'Martini', where: 'near you', rankers: 23 }), '#2 of 11 Martinis near you · 23 ranked');
assert.equal(rankCaption({ position: 1, of: 4, name: "Bee's Knees" }), "#1 of 4 Bee's Knees");
assert.equal(rankCaption({ position: 3, of: 9, name: 'Negroni', where: 'in New York', rankers: 0 }), '#3 of 9 Negronis in New York');

console.log('rowScore checks passed');
