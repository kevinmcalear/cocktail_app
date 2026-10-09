// Checks for scripts/technique-prep-fill.mjs: how prep names are read, and that
// the migration is the one the review sheet makes. Run: npm run test:unit
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { fromCsv, ingredientKey, parsePrep, toCsv, washKind } from './technique-prep-fill.mjs';

const read = (name: string) => {
  const p = parsePrep(name);
  return { tags: p.tags, base: p.baseUse ? p.baseText : '', adj: p.adjuncts };
};

// "{with}-{technique} {base}"
assert.deepEqual(read('Char Siu Fat-Washed Bourbon'), { tags: ['Fat wash'], base: 'Bourbon', adj: ['Char Siu Fat', 'Char Siu'] });
assert.deepEqual(read('Earl Grey-Infused Rum'), { tags: ['Infuse'], base: 'Rum', adj: ['Earl Grey'] });
assert.deepEqual(read('Pandan-Infused Sweet Vermouth'), { tags: ['Infuse'], base: 'Sweet Vermouth', adj: ['Pandan'] });
assert.deepEqual(read('Coconut Milk Washed Gin'), { tags: ['Milk wash'], base: 'Gin', adj: ['Coconut Milk'] });
assert.deepEqual(read('Milk-Washed Rum'), { tags: ['Milk wash'], base: 'Rum', adj: ['Milk'] });
assert.deepEqual(read('Cacao Nib-Smoked Cinzano Rosso'), { tags: ['Smoke'], base: 'Cinzano Rosso', adj: ['Cacao Nib'] });
// Other forms
assert.deepEqual(read('Wakaze Saké Infused with Beaufort Rinds'), { tags: ['Infuse'], base: 'Wakaze Saké', adj: ['Beaufort Rinds'] });
assert.deepEqual(read('Clément Blanc Rhum (Osmanthus-Infused)'), { tags: ['Infuse'], base: 'Clément Blanc Rhum', adj: ['Osmanthus'] });
assert.deepEqual(read('Clarified Coconut-Infused Bacardi Carta Blanca'), { tags: ['Clarify', 'Infuse'], base: 'Bacardi Carta Blanca', adj: ['Coconut'] });
assert.deepEqual(read('Smoked Bacon-Infused Bourbon'), { tags: ['Infuse'], base: 'Bourbon', adj: ['Smoked Bacon'] });
assert.deepEqual(read('Smoked Bourbon'), { tags: ['Smoke'], base: 'Bourbon', adj: [] });
assert.deepEqual(read('Yogurt-Washed Clarified 12-Year Rum'), { tags: ['Milk wash', 'Clarify'], base: '12-Year Rum', adj: ['Yogurt'] });
// Made from scratch: technique and with-what, never a bottle.
assert.deepEqual(read('Thyme Tincture'), { tags: ['Tincture'], base: '', adj: ['Thyme'] });
assert.deepEqual(read('Basil Olive Oil'), { tags: ['Oil'], base: '', adj: ['Basil'] });
assert.deepEqual(read('Black Truffle Distilled Ketel One Vodka'), { tags: ['Distil'], base: '', adj: ['Black Truffle'] });
assert.deepEqual(read('Distilled Lavender'), { tags: ['Distil'], base: '', adj: ['Lavender'] });
assert.deepEqual(read('House-Distilled Gin'), { tags: ['Distil'], base: '', adj: [] });
assert.deepEqual(read('Clarified Milk Punch'), { tags: ['Clarify', 'Milk wash'], base: '', adj: [] });
// Not the technique, or not readable.
assert.deepEqual(read('Clarified Butter').tags, []);
assert.deepEqual(read('Nitrogen Smoke').tags, []);
assert.deepEqual(read('Aged Egg Yolk').tags, []);
assert.deepEqual(read('Chochin 60 Nama Genshu & Terada Honke Kaikoshu Aged Sakes').tags, []);
assert.deepEqual(read('Sesame Oil Syrup').tags, []);
assert.deepEqual(read('Smoked Olive Oil').tags, ['Smoke']);
// A base that names a second technique reads neither base nor with-what.
assert.deepEqual(read('Beef Tallow Fat-Washed 36 South Whisky Infused With Rosemary'), { tags: ['Infuse', 'Fat wash'], base: '', adj: [] });

// Wash medium
assert.equal(washKind('Brown Butter'), 'Fat wash');
assert.equal(washKind('Parmesan and Comté'), 'Fat wash');
assert.equal(washKind('Hazelnut Yoghurt'), 'Milk wash');
assert.equal(washKind('Coconut'), null);
assert.equal(washKind('Avocado Ice Cream'), null);

// Same key as public.ingredient_key
assert.equal(ingredientKey("Michter's US*1 Bourbon"), 'michters us 1 bourbon');
assert.equal(ingredientKey('Cachaça & Lime'), 'cachaca and lime');

// The sheet round-trips, and the migration is the one it makes.
const sheet = readFileSync('scripts/data/technique-prep-fill.csv', 'utf8');
assert.equal(toCsv(fromCsv(sheet)), sheet);
const generated = spawnSync(process.execPath, ['scripts/technique-prep-fill.mjs', '--print'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
assert.equal(generated.status, 0, generated.stderr);
const file = readFileSync('supabase/migrations/20261012420000_technique_prep_fill.sql', 'utf8');
assert.equal(generated.stdout, file, 'run: node scripts/technique-prep-fill.mjs');
assert.doesNotMatch(file + sheet, /—|–/);
assert.match(file, /\$q\$Peanut Butter-Washed Bulleit Bourbon\$q\$, ARRAY\[\$q\$Fat wash\$q\$\]::text\[\], \$q\$Bulleit Bourbon\$q\$, NULL, \$q\$Peanut Butter\$q\$\)/);

console.log('technique-prep-fill.check: ok');
