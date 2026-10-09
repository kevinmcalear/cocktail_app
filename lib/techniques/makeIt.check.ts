// Checks for lib/techniques/makeIt.ts and needsFoamer. Run: npm run test:unit
import assert from 'node:assert/strict';

import { PREP_ACTIONS } from '../scale';
import { needsFoamer } from './foamPicker';
import { techniqueById, TECHNIQUES } from './index';
import { actionFor, isBoughtName, looksMadeInHouse, prepCardFor, waysToMake } from './makeIt';

const ids = (name: string) => waysToMake(name).map((t) => t.id);

// A typed prep finds the techniques that make it, most likely first, no repeats.
assert.equal(ids('Clarified grapefruit')[0], 'agar-quick');
assert.equal(ids('Clarified milk punch')[0], 'milk-wash');
assert.equal(new Set(ids('Clarified milk punch')).size, ids('Clarified milk punch').length);
assert.deepEqual(ids('Brown butter bourbon'), ['fat-wash']);
assert.ok(ids('Ginger foam').includes('siphon-foam'));
assert.equal(ids('Methylcellulose sour syrup')[0], 'sour-syrup');
assert.deepEqual(ids('Saline'), ['saline']);
assert.deepEqual(ids('Lime juice'), []);
assert.deepEqual(ids('  '), []);

// Every technique that makes an ingredient is reached by a name people write; methods never are.
const NAMES: Record<string, string[]> = {
  'sour-syrup': ['Sour syrup'], 'siphon-foam': ['Ginger foam'], 'vegan-siphon-foam': ['Coffee foam'], 'lecithin-air': ['Grapefruit air'],
  'agar-quick': ['Clarified lime juice'], 'agar-freeze-thaw': ['Freeze-thaw clarified lime'], 'gelatin-freeze-thaw': ['Tomato water'], centrifuge: ['Spun strawberry', 'Pectinex pear'],
  'milk-wash': ['Clarified milk punch', 'Yogurt-washed gin', 'Whey washed rum', 'Cream washed bourbon'], 'vegan-wash': ['Coconut milk washed rum', 'Soy milk punch'],
  'fat-wash': ['Coconut-washed rum', 'Bacon bourbon', 'Coconut fat washed white rum', 'Pistachio washed gin'],
  'nitrous-infusion': ['iSi coffee bourbon', 'Rapid infused gin'], 'sous-vide-infusion': ['Sous vide cherry bourbon'], 'cold-infusion': ['Macerated cherry brandy', 'Cold brew'],
  'vacuum-infusion': ['Compressed watermelon'], tincture: ['Gentian tincture', 'House bitters'], 'infused-oil': ['Mint oil', 'Basil oil'],
  'syrup-by-weight': ['Cinnamon syrup'], 'blender-syrup': ['Strawberry syrup'], 'honey-syrup': ['Honey syrup'], gomme: ['Gomme'], 'oleo-saccharum': ['Lemon oleo saccharum'],
  'acid-adjust': ['Acid-adjusted orange juice'], saline: ['Saline', 'Salt solution'], cordial: ['Lime cordial'], shrub: ['Drinking vinegar', 'Plum shrub'], orgeat: ['Almond syrup'],
  grenadine: ['Pomegranate syrup'], 'body-syrup': ['Body syrup'], suspension: ['Suspended mint'], 'reverse-spheres': ['Campari spheres'], 'fat-powder': ['Brown butter powder'],
  'force-carbonate': ['Carbonated negroni'], 'freeze-concentrate': ['Cryo lime', 'Pineapple concentrate'], 'lacto-ferment': ['Lacto-fermented plum'], tepache: ['Tepache'],
  kombucha: ['Ginger kombucha', 'Scoby'], 'quick-pickle': ['Cocktail onions'], 'dehydrated-citrus': ['Dried orange wheel'], smoke: ['Smoked syrup', 'Smoked maple'], rotovap: ['Hydrosol', 'Redistilled gin'],
};
for (const t of TECHNIQUES) {
  if (t.method) {
    assert.equal(NAMES[t.id], undefined, `${t.id} is a method`);
    continue;
  }
  assert.ok(NAMES[t.id]?.length, `${t.id} has a natural name`);
  for (const n of NAMES[t.id]) assert.ok(ids(n).includes(t.id), `"${n}" reaches ${t.id}: got ${ids(n).join(', ')}`);
}
for (const n of ['Reverse dry shake', 'Freezer martini', 'Pacojet sorbet', 'Liquid nitrogen', 'Clear ice']) assert.deepEqual(ids(n), [], `${n} is a method, never made in house`);
assert.equal(techniqueById('rotovap')!.gate, 'legal', 'rotovap keeps its legal gate');

// Aliases and spelling.
assert.equal(ids('Sous vide bourbon')[0], 'sous-vide-infusion');
assert.equal(ids('Nitro coffee rum')[0], 'nitrous-infusion');
assert.equal(ids('Coconut milk washed rum')[0], 'vegan-wash');
assert.equal(ids('Coconut-washed rum')[0], 'fat-wash');
assert.equal(ids('Yogurt washed gin')[0], 'milk-wash');
assert.deepEqual(ids('Lime super juice'), [], 'super juice is a kind of prep, not acid-adjusted juice');
assert.equal(looksMadeInHouse('Lime super juice'), true);

// Ranking knows what it starts from, and what changes it.
assert.equal(ids('Clarified rum')[0], 'milk-wash', 'a spirit is milk washed, not agar clarified (a juice method)');
assert.equal(ids('Clarified grapefruit')[0], 'agar-quick');
assert.equal(ids('Smoked syrup')[0], 'smoke');
assert.equal(ids('Grapefruit air')[0], 'lecithin-air');
assert.ok(!ids('Grapefruit air').includes('reverse-dry-shake'));

// Bought things are never preps.
for (const n of ['Sparkling wine', 'Sparkling water', 'Angostura bitters', 'Peychaud’s bitters', 'Maple syrup', 'Monin vanilla syrup', 'Rose’s lime cordial', "Rose's cordial", 'Olive brine', 'Smoked salt', 'Olive oil']) {
  assert.deepEqual(ids(n), [], `${n} is bought`);
  assert.equal(isBoughtName(n), true, n);
  assert.equal(looksMadeInHouse(n), false, n);
}
assert.equal(looksMadeInHouse('Pineapple chili shrub'), true);
assert.equal(looksMadeInHouse('Orange bitters'), true, 'bitters with no brand can be made');
assert.equal(looksMadeInHouse('Campari'), false);

// Every technique's tag is one the prep editor offers, so cards made here edit cleanly.
for (const t of TECHNIQUES) assert.ok((PREP_ACTIONS as readonly string[]).includes(actionFor(t)), `${t.id} → ${actionFor(t)}`);
assert.equal(actionFor(techniqueById('milk-wash')!), 'Milk wash');
assert.equal(actionFor(techniqueById('agar-quick')!), 'Clarify');

// The card leads with the amounts for its usual batch, keeps the timers, and points back to the library.
const card = prepCardFor(techniqueById('agar-quick')!);
assert.deepEqual(card.actions, ['Clarify']);
assert.equal(card.steps[0].body, 'For 375 g juice: 125 g water, 1 g agar.');
assert.ok(card.steps.some((s) => s.timer_seconds === 120));
assert.match(card.steps.at(-1)!.body, /Quick agar clarifying in Techniques/);
assert.equal(card.leadMinutes, 30);
for (const t of TECHNIQUES) for (const s of prepCardFor(t).steps) assert.ok(s.body.length <= 500, `${t.id} step fits item_steps`);

// A dry shake with nothing that foams asks for a foamer; one with egg white doesn't.
assert.equal(needsFoamer(['Dry shake', 'Shake'], ['Gin', 'Lemon juice']), true);
assert.equal(needsFoamer(['Reverse dry shake'], ['Gin', 'Egg white']), false);
assert.equal(needsFoamer(['Shake'], ['Gin']), false);
assert.equal(needsFoamer(['Dry shake'], ['Methylcellulose sour syrup']), false);

console.log('makeIt.check: ok');
