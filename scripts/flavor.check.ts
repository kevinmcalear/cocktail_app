import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DIMENSIONS as APP_DIMENSIONS, MIN_COVERAGE } from '../lib/flavor';
import {
  DIMENSIONS,
  parseAiFlavors,
  partWeight,
  profileFromSpec,
  ruleFor,
  type Dimension,
  type SpecPart,
} from '../supabase/functions/_shared/flavor';

// The flavor rules (supabase/functions/_shared/flavor.ts) must read the
// classics the way a bartender would.

type Line = [amount: number | null, unit: string | null, name: string, categories?: string[]];

const spec = (lines: Line[]): SpecPart[] =>
  lines.map(([amount, unit, name, categories], i) => ({ id: `i${i}`, name, amount, unit, categories }));

const CLASSICS: Record<string, Line[]> = {
  Negroni: [[30, 'ml', 'Gin'], [30, 'ml', 'Campari'], [30, 'ml', 'Sweet Vermouth'], [1, 'peel', 'Orange peel']],
  Daiquiri: [[60, 'ml', 'White Rum'], [22.5, 'ml', 'Lime Juice'], [22.5, 'ml', 'Simple Syrup']],
  'Espresso Martini': [[50, 'ml', 'Vodka'], [25, 'ml', 'Coffee Liqueur'], [30, 'ml', 'Espresso'], [10, 'ml', 'Simple Syrup']],
  'Old Fashioned': [[60, 'ml', 'Bourbon'], [7.5, 'ml', 'Demerara Syrup'], [2, 'dash', 'Angostura Bitters'], [1, 'peel', 'Orange peel']],
  Margarita: [[50, 'ml', 'Tequila Blanco'], [25, 'ml', 'Lime Juice'], [20, 'ml', 'Cointreau']],
  Penicillin: [[60, 'ml', 'Blended Scotch'], [22.5, 'ml', 'Lemon Juice'], [22.5, 'ml', 'Honey Ginger Syrup'], [7.5, 'ml', 'Islay Scotch']],
  Mojito: [[60, 'ml', 'White Rum'], [22.5, 'ml', 'Lime Juice'], [15, 'ml', 'Simple Syrup'], [8, 'leaf', 'Mint'], [null, 'top', 'Soda Water']],
  'Last Word': [[22.5, 'ml', 'Gin'], [22.5, 'ml', 'Green Chartreuse'], [22.5, 'ml', 'Maraschino Liqueur'], [22.5, 'ml', 'Lime Juice']],
  'Piña Colada': [[50, 'ml', 'White Rum'], [90, 'ml', 'Pineapple Juice'], [30, 'ml', 'Cream of Coconut'], [15, 'ml', 'Lime Juice']],
  'Mezcal Negroni': [[30, 'ml', 'Mezcal'], [30, 'ml', 'Campari'], [30, 'ml', 'Sweet Vermouth']],
  Martini: [[60, 'ml', 'Gin'], [15, 'ml', 'Dry Vermouth'], [1, 'twist', 'Lemon twist']],
};

const profiles = Object.fromEntries(Object.entries(CLASSICS).map(([name, lines]) => [name, profileFromSpec(spec(lines))]));
const top = (name: string, n: number): Dimension[] =>
  [...DIMENSIONS].sort((a, b) => profiles[name].profile[b] - profiles[name].profile[a]).slice(0, n);

if (process.env.FLAVOR_PRINT) {
  for (const [name, p] of Object.entries(profiles)) console.log(name.padEnd(18), top(name, 4).map((d) => `${d} ${p.profile[d]}`).join('  '));
}

// Every classic is fully understood by the rules.
for (const [name, p] of Object.entries(profiles)) {
  assert.equal(p.coverage, 1, `${name}: unknown ${p.unknown.map((u) => u.name).join(', ')}`);
  assert.equal(p.usedAi, false);
  for (const d of DIMENSIONS) assert.ok(p.profile[d] >= 0 && p.profile[d] <= 1, `${name} ${d} in range`);
}

const has = (dims: Dimension[], ...want: Dimension[]) => want.every((d) => dims.includes(d));

assert.ok(has(top('Negroni', 2), 'bitter', 'strong'), `Negroni reads bitter and strong: ${top('Negroni', 4)}`);
assert.ok(has(top('Daiquiri', 2), 'sour', 'sweet'), `Daiquiri reads sour and sweet: ${top('Daiquiri', 4)}`);
assert.ok(has(top('Espresso Martini', 3), 'sweet', 'bitter'), `Espresso Martini reads sweet and bitter: ${top('Espresso Martini', 4)}`);
assert.ok(profiles['Espresso Martini'].profile.creamy >= 0.25, 'Espresso Martini is creamy-ish');
assert.ok(profiles['Espresso Martini'].profile.creamy > profiles.Negroni.profile.creamy);
assert.equal(top('Old Fashioned', 1)[0], 'strong', `Old Fashioned reads strong: ${top('Old Fashioned', 4)}`);
assert.ok(profiles['Old Fashioned'].profile.bitter >= 0.25, 'Old Fashioned has its bitters');
assert.ok(has(top('Margarita', 3), 'sour'), `Margarita reads sour: ${top('Margarita', 4)}`);
assert.ok(profiles.Penicillin.profile.smoky >= 0.2 && profiles.Penicillin.profile.spicy >= 0.2, 'Penicillin: smoke and ginger');
assert.ok(profiles.Mojito.profile.herbal >= 0.4, 'Mojito: mint');
assert.ok(profiles.Mojito.profile.strong < profiles.Daiquiri.profile.strong, 'soda makes a Mojito lighter than a Daiquiri');
assert.ok(has(top('Last Word', 3), 'herbal', 'sour'), `Last Word reads herbal and sour: ${top('Last Word', 4)}`);
assert.ok(has(top('Piña Colada', 2), 'fruity', 'sweet'), `Piña Colada reads fruity and sweet: ${top('Piña Colada', 4)}`);
assert.ok(profiles['Piña Colada'].profile.creamy >= 0.4 && profiles.Daiquiri.profile.creamy === 0, 'Piña Colada is creamy');
assert.ok(profiles['Piña Colada'].profile.strong < 0.5, 'Piña Colada is not strong');
assert.ok(profiles['Mezcal Negroni'].profile.smoky >= 0.4 && profiles.Negroni.profile.smoky === 0, 'mezcal brings smoke');
assert.equal(top('Martini', 1)[0], 'strong');
assert.ok(profiles.Martini.profile.sweet < 0.2 && profiles.Martini.profile.sour < 0.2, 'a Martini is dry');

// Brand names and categories are understood; order matters.
assert.equal(ruleFor({ name: 'Yellow Chartreuse' })?.taste.sweet, 0.6);
assert.equal(ruleFor({ name: 'Diplomatico Reserva', categories: ['Aged / Añejo Rum'] })?.abv, 0.43, 'añejo rum is rum, not tequila');
assert.ok(ruleFor({ name: 'Rosemary' })?.taste.herbal, 'rosemary is a herb, not rosé');
assert.ok(ruleFor({ name: 'Tonic Water' })?.taste.bitter, 'tonic water is tonic, not water');
assert.equal(ruleFor({ name: 'Sugar Syrup' })?.x, undefined, 'sugar syrup is a syrup, not a cube');
assert.ok(ruleFor({ name: 'Rittenhouse', categories: ['Rye Whiskey', 'Whisk(e)y'] })?.taste.spicy, 'category fallback');
assert.ok(ruleFor({ name: 'Punt e Mes' })?.taste.bitter);
assert.equal(ruleFor({ name: 'House Shiitake Tincture' }), null);

// Unknown house ingredients lower coverage and are what the AI fill is asked about.
const house = profileFromSpec(spec([[45, 'ml', 'Gin'], [30, 'ml', 'House Shiitake Tincture No. 7']]).map((p) => ({ ...p, name: p.name })));
assert.equal(house.unknown.length, 1);
assert.ok(house.coverage > 0.5 && house.coverage < 1);
const filled = profileFromSpec(
  spec([[45, 'ml', 'Gin'], [30, 'ml', 'House Shiitake Tincture No. 7']]).map((p, i) => (i === 1 ? { ...p, ai: { taste: { smoky: 0.8, sweet: 0.5 }, abv: 0 } } : p))
);
assert.equal(filled.coverage, 1);
assert.equal(filled.usedAi, true);
assert.ok(filled.profile.smoky > 0.3);
assert.ok(filled.profile.strong < house.profile.strong, 'the filled tincture dilutes the gin');

// Weights: counts are garnishes, tops are 60 ml, dashes are small.
assert.deepEqual(partWeight({ amount: 2, unit: 'dash', name: 'Angostura' }), { flavor: 1.6, volume: 1.6 });
assert.deepEqual(partWeight({ amount: 3, unit: 'leaf', name: 'Mint' }), { flavor: 4.5, volume: 0 });
assert.deepEqual(partWeight({ amount: null, unit: 'top', name: 'Soda' }), { flavor: 60, volume: 60 });
assert.deepEqual(partWeight({ amount: 1, unit: 'oz', name: 'Gin' }), { flavor: 29.57, volume: 29.57 });
assert.equal(profileFromSpec([]).coverage, 0);

// The AI answer keeps numbers for the ingredients asked about, and nothing else.
const parsed = parseAiFlavors(
  JSON.stringify({
    ingredients: [
      { id: 'a', sweet: 0.7, smoky: 3, abv: 0.2, notes: 'Secret Brand XO', name: 'Secret Brand XO' },
      { id: 'b', sour: 'lots' },
      { id: 'not-asked', sweet: 1 },
    ],
  }),
  ['a', 'b']
);
assert.deepEqual(parsed.get('a'), { taste: { sweet: 0.7, smoky: 1 }, abv: 0.2 });
assert.deepEqual(parsed.get('b'), { taste: {}, abv: 0 });
assert.equal(parsed.has('not-asked'), false);
assert.equal(parseAiFlavors('not json', ['a']).size, 0);

// The app, the worker and the database agree on the dimensions and the coverage floor.
assert.deepEqual([...APP_DIMENSIONS], [...DIMENSIONS]);
const migration = readFileSync(new URL('../supabase/migrations/20260928300000_flavor_profiles.sql', import.meta.url), 'utf8');
for (const d of DIMENSIONS) assert.match(migration, new RegExp(`"${d}" real NOT NULL`), `item_flavors has ${d}`);
assert.match(migration, new RegExp(`"coverage" >= ${MIN_COVERAGE}\\b`), 'get_my_taste uses the same coverage floor');

console.log('flavor.check: ok');
