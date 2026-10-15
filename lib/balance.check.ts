import assert from 'node:assert/strict';

import { balanceOf, tasteWord } from './balance';

const line = (name: string, amount: number | null, unit: string | null = 'ml') => ({ name, amount, unit });

// Nothing yet: nothing to say.
assert.equal(balanceOf([]), null);

// Mezcal and lime, no sugar: the classic gap.
const sourOnly = balanceOf([line('Mezcal', 45), line('Lime Juice', 22.5)]);
assert.ok(sourOnly, 'mezcal and lime are understood');
assert.ok(sourOnly.sour > 0.25 && sourOnly.sweet < 0.1, `sour without sweet: ${JSON.stringify(sourOnly)}`);
assert.match(sourOnly.hint ?? '', /nothing sweet/);

// A daiquiri is balanced: no hint.
const daiquiri = balanceOf([line('White Rum', 60), line('Lime Juice', 22.5), line('Simple Syrup', 15)]);
assert.ok(daiquiri && daiquiri.sweet > 0.1);
assert.equal(daiquiri?.hint, null);

// Spirit alone: a nudge towards a stirred drink.
assert.match(balanceOf([line('Rye Whiskey', 60)])?.hint ?? '', /All spirit/);

// Mostly unknown ingredients: no meters that would mislead.
assert.equal(balanceOf([line('Fermented Plum Koji Thing', 60), line('Gin', 15)]), null);

console.log('balance checks passed');

assert.equal(tasteWord('strong', 0.2), 'light');
assert.equal(tasteWord('strong', 0.9), 'strong');
assert.equal(tasteWord('sweet', 0), 'none');
assert.equal(tasteWord('sour', 0.1), 'a touch');
assert.equal(tasteWord('bitter', 0.3), 'a little');
