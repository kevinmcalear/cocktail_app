import assert from 'node:assert/strict';

import { mainPour, menuNote } from './menuNote';

const l = (name: string, amount: number | null, unit = 'ml', genericName: string | null = null) => ({ name, genericName, amount, unit });
const spritz = [l('Fino sherry', 30, 'ml', 'Sherry'), l('Soda water', null, 'top'), l('Lemon juice', 10)];
const negroni = { name: 'Negroni', lines: [l('Gin', 30), l('Campari', 30), l('Sweet vermouth', 30)] };
const daiquiri = { name: 'Daiquiri', lines: [l('White rum', 60), l('Lime juice', 22.5), l('Simple syrup', 15)] };
const martini = { name: 'Martini', lines: [l('Gin', 60), l('Dry vermouth', 10)] };

assert.equal(mainPour(spritz), 'sherry');
assert.equal(mainPour(daiquiri.lines), 'white rum');
assert.equal(mainPour([l('Soda water', null, 'top')]), null);

assert.equal(menuNote('Winter menu', spritz, [negroni, daiquiri, martini]), 'On Winter menu it’s the lightest drink, and the only sherry one.');
// A sherry drink already there: only the strength.
const bamboo = { name: 'Bamboo', lines: [l('Amontillado sherry', 45), l('Dry vermouth', 45)] };
assert.equal(menuNote('Winter menu', spritz, [negroni, bamboo, martini]), 'On Winter menu it’s the lightest drink.');
// The strongest, and a pour others share.
assert.equal(menuNote('Winter menu', martini.lines, [daiquiri, { name: 'Spritz', lines: spritz }, { name: 'Gimlet', lines: [l('Gin', 50), l('Lime cordial', 20)] }]), 'On Winter menu it’s the strongest drink.');
// Too few others to say.
assert.equal(menuNote('Winter menu', spritz, [negroni]), null);
assert.equal(menuNote('Winter menu', [], [negroni, daiquiri]), null);

console.log('menuNote: ok');
