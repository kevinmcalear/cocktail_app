import assert from 'node:assert/strict';

import { bottleKindRow, guessBottleKind } from './newBottle';

assert.equal(guessBottleKind('Pommeau'), 'wine');
assert.equal(guessBottleKind('Ki No Bi Gin'), 'spirit');
assert.equal(guessBottleKind('Fever-Tree ginger beer'), 'mixer');
assert.equal(guessBottleKind('Pampero rum liqueur'), 'liqueur');
assert.equal(guessBottleKind('Pilsner Urquell'), 'beer');
assert.equal(guessBottleKind('Something else'), null);

const row = (id: string) => ({ id, name: id });
const core = [row('Gin'), row('Spirit'), row('Fortified wine'), row('Wine'), row('Cider'), row('Beer')];
// The kind the name says, while what it is stays as guessed; else the broad one.
assert.equal(bottleKindRow('Ki No Bi Gin', 'spirit', core)?.id, 'Gin');
assert.equal(bottleKindRow('Ki No Bi Gin', 'liqueur', core, [...core, row('Liqueur')])?.id, 'Liqueur');
assert.equal(bottleKindRow('Pommeau', 'wine', core)?.id, 'Fortified wine');
assert.equal(bottleKindRow('Cloudy apple cider', 'beer', core)?.id, 'Cider');
assert.equal(bottleKindRow('Pommeau', null, core), null);

console.log('newBottle: ok');
