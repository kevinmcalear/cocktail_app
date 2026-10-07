import assert from 'node:assert/strict';

import { partWeight } from '../supabase/functions/_shared/flavor';
import {
  aiAnswerSchema,
  GLASSES,
  glassFromName,
  iceFromName,
  methodFromNames,
  parseAiDrink,
  parseAiLooks,
  sketchFromDrink,
  type SketchDrink,
  type SketchLine,
} from '../supabase/functions/_shared/sketch';

// The drawing inputs (supabase/functions/_shared/sketch.ts) must serve the
// classics the way a bartender would, from whatever data a drink has.

type Line = [amount: number | null, unit: string | null, name: string];
const lines = (spec: Line[]): SketchLine[] =>
  spec.map(([amount, unit, name], i) => ({ id: `i${i}`, name, amount, unit, volume: partWeight({ amount, unit, name }).volume }));
const drink = (name: string, spec: Line[], more: Partial<SketchDrink> = {}) => sketchFromDrink({ name, lines: lines(spec), ...more });
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const redness = (hex: string) => parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(3, 5), 16);

// --- the drink's own data wins, under the app's real names ---
assert.equal(glassFromName('Coupette'), 'coupe');
assert.equal(glassFromName('Nick & Nora'), 'nick');
assert.equal(glassFromName('Small Highball'), 'fizz');
assert.equal(glassFromName('Collins'), 'collins');
assert.equal(glassFromName('Small Rocks'), 'rocks');
assert.equal(glassFromName('Julep Cup'), 'julep');
assert.equal(glassFromName('Custom'), null);
assert.equal(iceFromName('Large Cube'), 'large');
assert.equal(iceFromName('Cubes'), 'cubes');
assert.equal(iceFromName('Crushed'), 'crushed');
assert.equal(iceFromName('Spear'), 'spear');
assert.equal(iceFromName('Shaved'), 'shaved');
assert.equal(iceFromName('Sphere'), 'sphere');
assert.equal(methodFromNames(['Stir']), 'stir');
assert.equal(methodFromNames(['dry shake and shake']), 'shake');
assert.equal(methodFromNames(['Build', 'Shake']), 'shake');
assert.equal(methodFromNames(['Blitz']), 'blend');
assert.equal(methodFromNames(['Straight Pour']), 'pour');

const data = drink('House Thing', [[50, 'ml', 'Gin']], { glass: 'Coupette', ice: 'Cubes', methods: ['Stir'] });
assert.deepEqual([data.inputs.glass, data.inputs.ice, data.inputs.method], ['coupe', 'cubes', 'stir']);
assert.deepEqual([data.inputs.from.glass, data.inputs.from.ice, data.inputs.from.method], ['data', 'data', 'data']);

// --- classics from their specs alone ---
const negroni = drink('Negroni', [[30, 'ml', 'Gin'], [30, 'ml', 'Campari'], [30, 'ml', 'Sweet Vermouth'], [1, 'peel', 'Orange peel']]);
assert.equal(negroni.inputs.glass, 'rocks');
assert.equal(negroni.inputs.ice, 'large');
assert.equal(negroni.inputs.method, 'stir');
assert.equal(negroni.inputs.foam, null, 'stirred drinks never foam');
assert.equal(negroni.inputs.garnish, 'orange_peel');
assert.equal(negroni.inputs.coverage, 1);
assert.ok(redness(negroni.inputs.liquid.hex) > 60 && negroni.inputs.liquid.alpha > 0.8, `Negroni is a deep red: ${JSON.stringify(negroni.inputs.liquid)}`);

const espresso = drink('Espresso Martini', [[50, 'ml', 'Vodka'], [25, 'ml', 'Coffee Liqueur'], [30, 'ml', 'Espresso'], [10, 'ml', 'Simple Syrup']]);
assert.equal(espresso.inputs.glass, 'martini');
assert.equal(espresso.inputs.foam, 'crema');
assert.equal(espresso.inputs.garnish, 'coffee_beans');
assert.ok(lum(espresso.inputs.liquid.hex) < 0.2, `Espresso Martini is dark: ${espresso.inputs.liquid.hex}`);

const clover = drink('Clover Club', [[45, 'ml', 'Gin'], [15, 'ml', 'Raspberry Syrup'], [15, 'ml', 'Lemon Juice'], [15, 'ml', 'Egg White']], { methods: ['dry shake and shake'] });
assert.equal(clover.inputs.glass, 'coupe');
assert.equal(clover.inputs.foam, 'cap', 'egg white makes a cap');
assert.equal(clover.inputs.liquid.alpha, 1, 'egg white turns it opaque');

const lastWord = drink('Last Word', [[22.5, 'ml', 'Gin'], [22.5, 'ml', 'Green Chartreuse'], [22.5, 'ml', 'Maraschino Liqueur'], [22.5, 'ml', 'Lime Juice']]);
assert.equal(lastWord.inputs.foam, 'sheen', 'a shaken citrus drink gets a sheen');
const [lr, lg, lb] = [1, 3, 5].map((i) => parseInt(lastWord.inputs.liquid.hex.slice(i, i + 2), 16));
assert.ok(lg > lr && lg > lb, `Last Word is green: ${lastWord.inputs.liquid.hex}`);

const gt = drink('Gin & Tonic', [[50, 'ml', 'Gin'], [null, 'top', 'Tonic Water']]);
assert.equal(gt.inputs.glass, 'highball');
assert.equal(gt.inputs.ice, 'cubes');
assert.equal(gt.inputs.fizz, true);
assert.ok(gt.inputs.liquid.alpha <= 0.2, 'a G&T is nearly clear');

const julep = drink('Mint Julep', [[60, 'ml', 'Bourbon'], [10, 'ml', 'Simple Syrup'], [8, 'leaf', 'Mint']]);
assert.deepEqual([julep.inputs.glass, julep.inputs.ice, julep.inputs.garnish], ['julep', 'crushed', 'mint']);

const penicillin = drink('Penicillin', [[60, 'ml', 'Blended Scotch'], [22.5, 'ml', 'Lemon Juice'], [22.5, 'ml', 'Honey Ginger Syrup'], [7.5, 'float', 'Islay Scotch']]);
assert.ok(penicillin.inputs.float, 'the Islay float is its own layer');
assert.equal(penicillin.inputs.foam, null, 'a float replaces foam');

const bramble = drink('Bramble', [[45, 'ml', 'Gin'], [22.5, 'ml', 'Lemon Juice'], [15, 'ml', 'Simple Syrup'], [15, 'drizzle', 'Crème de Mûre']], { ice: 'Crushed' });
assert.ok(bramble.inputs.bleed, 'the drizzle bleeds through the ice');
assert.equal(bramble.inputs.foam, null, 'crushed ice hides foam');

// Unit-less amounts (most imported specs) still read as ml.
const unitless = drink('Daiquiri', [[60, null, 'White Rum'], [22, null, 'Lime Juice'], [15, null, 'Simple Syrup']]);
assert.equal(unitless.inputs.coverage, 1);
assert.equal(unitless.inputs.glass, 'coupe');

// The name beats a description that mentions other drinks or bottles.
const boulevardier = drink('Pistachio Boulevardier', [[30, 'ml', 'Bourbon'], [30, 'ml', 'Sweet Vermouth'], [30, 'ml', 'Campari']], {
  description: 'Bourbon, Carpano and Martini Bitter, washed with pistachio.',
});
assert.equal(boulevardier.inputs.glass, 'rocks');

// --- drinks with little or no data ---
const nameOnly = drink('Paloma', []);
assert.equal(nameOnly.inputs.glass, 'highball', 'the name alone gives the glass away');
assert.equal(nameOnly.askDrink, true, 'with no spec, ask the AI fill about the whole drink');

const described = drink('Velvet Hour', [], { description: 'A blush pink, silky sour served up in a coupe.' });
assert.equal(described.inputs.ice, 'none');
assert.ok(redness(described.inputs.liquid.hex) > 40, `"blush pink" colours the liquid: ${described.inputs.liquid.hex}`);

const nothing = drink('Untitled No. 4', []);
assert.ok((GLASSES as readonly string[]).includes(nothing.inputs.glass));
assert.equal(nothing.inputs.from.glass, 'default');
assert.equal(nothing.inputs.from.liquid, 'default');

// Unknown ingredients are what the AI fill is asked about, and an answer fills them in.
const house = lines([[30, 'ml', 'House Beetroot Shrub Mk II'], [45, 'ml', 'Gin']]);
const before = sketchFromDrink({ name: 'Garden Thing', lines: [{ ...house[0], name: 'Zorbleflux cordial' }, house[1]] });
assert.equal(before.unknown.length, 1);
const after = sketchFromDrink({
  name: 'Garden Thing',
  lines: [{ ...house[0], name: 'Zorbleflux cordial', look: { color: '#8a1040', tint: 1 } }, house[1]],
});
assert.equal(after.unknown.length, 0);
assert.equal(after.usedAi, true);
assert.ok(redness(after.inputs.liquid.hex) > 40, 'the AI colour reaches the liquid');

// A cached AI answer settles a drink with no data, but never overrides the drink's own glass.
const aiDrink = sketchFromDrink({ name: 'Mystery', lines: [], ai: { glass: 'flute', ice: 'none', method: 'build', color: '#f0e4b0', garnish: 'lemon_peel' } });
assert.deepEqual([aiDrink.inputs.glass, aiDrink.inputs.from.glass, aiDrink.inputs.garnish], ['flute', 'ai', 'lemon_peel']);
const aiVsData = sketchFromDrink({ name: 'Mystery', glass: 'Rocks', lines: [], ai: { glass: 'flute' } });
assert.equal(aiVsData.inputs.glass, 'rocks');

// --- the AI fill's answers are parsed strictly ---
const looks = parseAiLooks(
  JSON.stringify({ ingredients: [
    { id: 'a', color: '#8A1040', tint: 2, foam: 'cap' },
    { id: 'b', color: 'red', tint: 0.5 },
    { id: 'zz', color: '#ffffff', tint: 0 },
    { id: 'c', color: '#112233', tint: 0.2, foam: 'Name of a brand' },
  ] }),
  ['a', 'b', 'c'],
);
assert.deepEqual(looks.get('a'), { color: '#8a1040', tint: 1, foam: 'cap' });
assert.equal(looks.has('b'), false, 'a colour must be a hex');
assert.equal(looks.has('zz'), false, 'only asked ids');
assert.equal(looks.get('c')?.foam, null, 'off-list foam is dropped');
assert.deepEqual(parseAiDrink(JSON.stringify({ drink: { glass: 'flute', ice: 'lava', method: 'build', garnish: 'a twist of fate', color: '#F0E4B0' } })), {
  glass: 'flute', ice: undefined, method: 'build', garnish: null, color: '#f0e4b0', foam: null,
});
assert.equal(parseAiDrink('not json'), null);
// Near misses are read like the drink's own data, not thrown away.
assert.deepEqual(parseAiDrink(JSON.stringify({ drink: { glass: 'Coupe glass', ice: 'Large Cube', method: 'Shaken', garnish: 'Lemon twist', color: '#FC9' } })), {
  glass: 'coupe', ice: 'large', method: 'shake', garnish: 'lemon_peel', color: '#ffcc99', foam: null,
});
assert.equal(parseAiLooks(JSON.stringify({ ingredients: [{ id: 'a', color: '#ABC', tint: 0.5 }] }), ['a']).get('a')?.color, '#aabbcc');

// The answer schema pins every enum to its list.
const schema = aiAnswerSchema(['sweet', 'sour'], true) as { properties: { drink: { properties: { glass: { enum: string[] } } }; ingredients: { items: { required: string[] } } }; required: string[] };
assert.deepEqual(schema.properties.drink.properties.glass.enum, [...GLASSES]);
assert.ok(schema.properties.ingredients.items.required.includes('sweet'));
assert.deepEqual(schema.required, ['ingredients', 'drink']);
assert.deepEqual((aiAnswerSchema(['sweet'], false) as { required: string[] }).required, ['ingredients']);
assert.equal(parseAiDrink(JSON.stringify({ drink: { garnish: 'cherry' } })), null, 'an answer with nothing to draw is no answer');

// Nothing but enums, numbers, booleans and hex colours ever comes out.
for (const r of [negroni, espresso, clover, gt, julep, nameOnly, described, nothing, after, aiDrink]) {
  const walk = (v: unknown, path: string): void => {
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return;
    if (typeof v === 'string') {
      assert.ok(/^#[0-9a-f]{6}$/.test(v) || /^[a-z_]+$/.test(v), `${path} is not an enum or hex: ${v}`);
      return;
    }
    for (const [k, x] of Object.entries(v as object)) walk(x, `${path}.${k}`);
  };
  walk(r.inputs, 'inputs');
}

console.log('sketch rules: ok');
