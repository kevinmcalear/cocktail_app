import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OUT, brandIn, brandPhrases, loadWords, migration, plan, sentenceCase } from './catalog-sentence-case.mjs';

const words = loadWords();
const cases: [string, string | null][] = [
  ['Lime Juice', 'Lime juice'],
  ['Agave Syrup', 'Agave syrup'],
  ['Soda Water', 'Soda water'],
  ['Rich Demerara Syrup', 'Rich demerara syrup'],
  ['Coffee-Infused Campari', 'Coffee-infused Campari'],
  ['London Dry Gin', 'London dry gin'],
  ['Old Tom Gin', 'Old Tom gin'],
  ['Black Walnut and Angostura Bitters', 'Black walnut and Angostura bitters'],
  ['Hazy IPA Syrup', 'Hazy IPA syrup'],
  ['Passion Fruit Purée', 'Passion fruit purée'],
  ['Sugar (White)', 'Sugar (white)'],
  // A word the lists don't know (a brand, a person) leaves the name alone.
  ['Milk-Washed Wild Turkey Rye', null],
  ['Butterscotch Monkey Shoulder', null],
  // Nothing to change.
  ['Lime juice', null],
  ['Gin', null],
];
for (const [name, want] of cases) assert.equal(sentenceCase(name, words), want, name);

// A style that names a bottle's brand is left alone, even when every word is known.
const rows = [
  { name: 'Grey Goose Vodka', role: 'product', brand: 'Grey Goose', has_maker: true },
  { name: 'Stock Spiced Rum', role: 'product', brand: 'Stock', has_maker: true },
  { name: 'Barley Tea Grey Goose', role: 'prep', brand: null, has_maker: false },
  { name: 'Beef Stock', role: 'generic', brand: null, has_maker: false },
  { name: 'Lime Juice', role: 'generic', brand: null, has_maker: false },
  { name: 'Lime Juice Cordial', role: 'product', brand: null, has_maker: false },
];
assert.equal(brandIn('Barley Tea Grey Goose', brandPhrases(rows, words)), 'grey goose');
assert.deepEqual(plan(rows, words).changes, [['Beef Stock', 'Beef stock'], ['Lime Juice', 'Lime juice']]);

// Every line of the migration follows the rule, changes only letter case, and
// the file is exactly what the generator writes for those lines.
const sql = readFileSync(OUT, 'utf8');
const pairs = [...sql.matchAll(/^\(\$q\$(.*?)\$q\$, \$q\$(.*?)\$q\$\)[,;]$/gm)].map((m) => [m[1], m[2]] as [string, string]);
assert.ok(pairs.length > 6000, `only ${pairs.length} renames`);
assert.equal(new Set(pairs.map(([a]) => a)).size, pairs.length, 'an old name is listed twice');
for (const [from, to] of pairs) {
  assert.equal(from.toLowerCase(), to.toLowerCase(), `${from} -> ${to} changes more than case`);
  assert.equal(sentenceCase(from, words), to, from);
}
assert.equal(migration(pairs), sql);
assert.doesNotMatch(sql, /—|–/);
