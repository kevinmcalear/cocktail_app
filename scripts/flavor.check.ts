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
// classics the way a bartender would. scripts/data/flavor-classics.json is
// the catalog spec of 70 classics as the worker sees it; EXPECT says how each
// should read, in the app's words: 0 barely, 1 a little, 2 fairly, 3 very,
// 4 intensely. "botanical>=3" means at least very botanical. Agreed with
// Kevin on 2026-10-08; change a line here when a bartender disagrees.

type Line = Omit<SpecPart, 'id'>;
const classics = JSON.parse(readFileSync(new URL('./data/flavor-classics.json', import.meta.url), 'utf8')) as { name: string; lines: Line[] }[];
const profiles = Object.fromEntries(classics.map((c) => [c.name, profileFromSpec(c.lines.map((l, i) => ({ id: `i${i}`, ...l })))]));
const WORDS = [0.15, 0.35, 0.6, 0.8];
const word = (v: number) => WORDS.filter((w) => v >= w).length;

const EXPECT: Record<string, string> = {
  'Amaretto Sour': 'sweet>=3 sour>=3 creamy>=2',
  Americano: 'bitter>=3 strong<=1',
  'Aperol Spritz': 'fruity>=3 sour<=1 bitter>=2',
  Aviation: 'botanical>=2 herbal<=0 sour>=3',
  Bamboo: 'bitter<=2 strong<=2',
  "Bee's Knees": 'herbal<=0 botanical>=2 sour>=3',
  Bellini: 'sour<=1 fruity>=4',
  'Black Russian': 'strong>=4 sweet>=2',
  'Bloody Mary': 'savory>=3 spicy>=1 sour<=2',
  Boulevardier: 'bitter>=4 strong>=4',
  Bramble: 'sour>=3 fruity>=2 herbal<=0',
  'Brandy Alexander': 'creamy>=4 sweet>=4',
  Caipirinha: 'sour>=3 sweet<=2',
  'Clover Club': 'herbal<=0 fruity>=2',
  'Corpse Reviver #2': 'sour>=4 fruity>=3',
  Cosmopolitan: 'sour>=4 fruity>=3',
  'Cuba Libre': 'sweet>=3',
  Daiquiri: 'sour>=4 sweet>=3 herbal<=0',
  'Dirty Martini': 'savory>=2 herbal<=0 botanical>=3',
  'Espresso Martini': 'bitter>=3 sweet>=2',
  'French 75': 'sour<=2',
  Gibson: 'botanical>=4 herbal<=0',
  Gimlet: 'herbal<=0 sour>=4',
  'Gin and Tonic': 'bitter>=3 botanical>=2 sweet<=2',
  'Gin Basil Smash': 'herbal>=4',
  'Gin Fizz': 'sour>=3',
  Grasshopper: 'creamy>=4 herbal>=3',
  'Hanky Panky': 'bitter>=2 botanical>=3',
  Hurricane: 'fruity>=4 sour>=4',
  'Irish Coffee': 'bitter<=2 creamy>=2',
  'Jack Rose': 'fruity>=3 sour>=4',
  'Jungle Bird': 'bitter>=2 fruity>=4',
  'Kir Royale': 'sour<=1',
  'Last Word': 'herbal>=3 sour>=4',
  'Long Island Iced Tea': 'sweet>=3',
  'Mai Tai': 'sour>=4 sweet>=4',
  Manhattan: 'strong>=4 spiced<=2 spicy<=0',
  Margarita: 'sour>=4 savory>=1',
  Martinez: 'sweet>=3 botanical>=2 herbal<=0',
  Martini: 'botanical>=4 herbal<=0 sweet<=0 sour<=0 strong>=4',
  'Mezcal Margarita': 'smoky>=4',
  Mimosa: 'sour<=2 fruity>=4',
  'Mint Julep': 'herbal>=4 strong>=4',
  Mojito: 'herbal>=3 sour>=3',
  'Moscow Mule': 'spicy>=4 spiced<=0',
  'Naked and Famous': 'smoky>=3 herbal>=3',
  Negroni: 'bitter>=4 sweet>=2 botanical>=2',
  'Oaxaca Old Fashioned': 'smoky>=2 strong>=4 herbal<=1 spiced<=2',
  'Old Fashioned': 'strong>=4 spiced>=3 spiced<=3 spicy<=0',
  Paloma: 'sweet>=2 fruity>=2',
  'Paper Plane': 'bitter>=3 sour>=4',
  Penicillin: 'smoky>=1 spicy>=1 sour>=3',
  'Piña Colada': 'fruity>=4 sweet>=4 creamy>=2 strong<=1',
  'Pisco Sour': 'sour>=3 creamy>=2',
  'Ramos Gin Fizz': 'creamy>=3',
  'Rob Roy': 'smoky<=1 strong>=4',
  Sazerac: 'strong>=4 spiced<=3 herbal>=1',
  'Sherry Cobbler': 'savory<=1 strong<=2',
  Sidecar: 'fruity>=4 sour>=3',
  Southside: 'herbal>=4',
  'Tequila Sunrise': 'fruity>=4 sweet>=4',
  'Tom Collins': 'sour>=4 herbal<=0',
  Toronto: 'bitter>=3 herbal>=3',
  Tuxedo: 'botanical>=3 herbal<=0',
  Vesper: 'botanical>=3 herbal<=0',
  'Vieux Carré': 'strong>=4 bitter<=2',
  'Whiskey Sour': 'sour>=3 sweet>=3 creamy>=1',
  'White Negroni': 'bitter>=4 botanical>=3',
  'White Russian': 'creamy>=4',
  Zombie: 'strong>=4 spiced>=2',
};

if (process.env.FLAVOR_PRINT) {
  for (const [name, p] of Object.entries(profiles)) {
    console.log(name.padEnd(22), DIMENSIONS.filter((d) => p.profile[d] >= 0.15).map((d) => `${d} ${p.profile[d]}`).join('  '));
  }
}

assert.deepEqual(Object.keys(EXPECT).sort(), classics.map((c) => c.name).sort(), 'every classic has expectations');
for (const [name, p] of Object.entries(profiles)) {
  // Every classic is fully understood by the rules, with no AI help.
  assert.equal(p.coverage, 1, `${name}: unknown ${p.unknown.map((u) => u.name).join(', ')}`);
  assert.equal(p.usedAi, false, `${name} needs no AI`);
  for (const d of DIMENSIONS) assert.ok(p.profile[d] >= 0 && p.profile[d] <= 1, `${name} ${d} in range`);
  for (const want of EXPECT[name].split(' ')) {
    const [, d, op, n] = want.match(/^(\w+)(>=|<=)(\d)$/)!;
    const got = word(p.profile[d as Dimension]);
    assert.ok(op === '>=' ? got >= Number(n) : got <= Number(n), `${name}: wanted ${want}, got ${d} ${p.profile[d as Dimension]}`);
  }
}

const P = (name: string) => profiles[name].profile;
assert.ok(P('Mojito').herbal > P('Martini').herbal && P('Last Word').herbal > P('Martini').herbal, 'mint and Chartreuse are herbal, gin is not');
assert.ok(P('Martini').botanical > P('Mojito').botanical, 'gin is botanical');
assert.ok(P('Moscow Mule').spicy > P('Old Fashioned').spicy, 'ginger is heat, bitters are spice');
assert.ok(P('Mojito').strong < P('Daiquiri').strong, 'soda makes a Mojito lighter than a Daiquiri');
assert.ok(P('Tom Collins').sour > P('Gin Fizz').sour && P('Gin Fizz').sour >= 0.6, 'measured soda lightens, it does not wash out');

// Brand names and categories are understood; order matters.
assert.equal(ruleFor({ name: 'Yellow Chartreuse' })?.taste.sweet, 0.6);
assert.equal(ruleFor({ name: 'Diplomatico Reserva', categories: ['Aged / Añejo Rum'] })?.abv, 0.43, 'añejo rum is rum, not tequila');
assert.ok(ruleFor({ name: 'Rosemary' })?.taste.herbal, 'rosemary is a herb, not rosé');
assert.ok(ruleFor({ name: 'Tonic Water' })?.taste.bitter, 'tonic water is tonic, not water');
assert.equal(ruleFor({ name: 'Sugar Syrup' })?.x, undefined, 'sugar syrup is a syrup, not a cube');
assert.ok(ruleFor({ name: 'Rittenhouse', categories: ['Rye Whiskey', 'Whisk(e)y'] })?.taste.spiced, 'category fallback');
assert.ok(ruleFor({ name: 'Lemon', unit: 'twist' })?.taste.fruity && !ruleFor({ name: 'Lemon', unit: 'twist' })?.taste.sour, 'a twist is peel, not juice');
assert.equal(ruleFor({ name: 'Lemon' })?.taste.sour, 1, 'a lemon is juice');
assert.ok(ruleFor({ name: 'Punt e Mes' })?.taste.bitter);
assert.equal(ruleFor({ name: 'House Shiitake Tincture' }), null);

const spec = (lines: [number | null, string | null, string][]): SpecPart[] =>
  lines.map(([amount, unit, name], i) => ({ id: `i${i}`, name, amount, unit }));

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
const sql = (file: string) => readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');
const migrations = sql('20260928300000_flavor_profiles.sql') + sql('20261009600000_flavor_dimensions.sql');
for (const d of DIMENSIONS) assert.match(migrations, new RegExp(`"${d}" real NOT NULL`), `item_flavors has ${d}`);
assert.match(sql('20261009600000_flavor_dimensions.sql'), new RegExp(`"coverage" >= ${MIN_COVERAGE}\\b`), 'get_my_taste uses the same coverage floor');

console.log('flavor.check: ok');
