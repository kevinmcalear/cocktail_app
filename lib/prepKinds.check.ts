// Checks for lib/prepKinds.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { flavourWords, guessKind, keepsText, leadText, openSlots, partsText, PREP_KINDS, prepAmounts, prepFromTechnique, prepYield, slotMessage, startPrep, withFacts } from './prepKinds';
import { techniqueById } from './techniques';
import { prepCardFor } from './techniques/makeIt';
import { nameFor, nameParts, prepFacts, slotIngredient } from './techniques/template';

// The name says the kind.
assert.equal(guessKind('Pineapple chili shrub'), 'shrub');
assert.equal(guessKind('Lime cordial'), 'cordial');
assert.equal(guessKind('Rich demerara syrup'), 'rich');
assert.equal(guessKind('Honey syrup'), 'syrup');
assert.equal(guessKind('Lemon oleo saccharum'), 'oleo');
assert.equal(guessKind('Lime super juice'), 'super');
assert.equal(guessKind('Chamomile infused gin'), 'infusion');
assert.equal(guessKind('Clarified grapefruit'), null);
assert.deepEqual(flavourWords('Pineapple chili shrub'), ['Pineapple', 'Chili']);
assert.deepEqual(flavourWords('Rich simple syrup'), []);

// A cold shrub: the fruit is the base, equal parts, the extra flavour waits for an amount.
const shrub = startPrep('shrub', 'Pineapple chili shrub');
assert.deepEqual(shrub.lines.map((l) => l.name), ['Pineapple', 'Sugar', 'Apple cider vinegar', 'Chili']);
assert.equal(shrub.baseKey, shrub.lines[0].key);
assert.deepEqual(prepAmounts(shrub).map((a) => a.amount), [300, 300, 300, null]);
assert.equal(prepYield(shrub), 670, '300 g fruit gives about 180 ml juice, plus the sugar and vinegar');
assert.equal(shrub.steps.length, 5);
assert.equal(shrub.steps[1].timer_seconds, 86400, 'the day in the fridge is a timer');
assert.equal(leadText(shrub.leadMinutes), 'Start 3 days ahead');
assert.equal(shrub.keepsHours, 3 * 7 * 24, '3 to 6 weeks once opened: the shorter');

// The base can move; everything follows.
assert.deepEqual(prepAmounts({ ...shrub, baseAmount: 450 }).map((a) => a.amount), [450, 450, 450, null]);
// A typed amount on a line with no parts counts.
const withChili = { ...shrub, lines: shrub.lines.map((l) => (l.name === 'Chili' ? { ...l, amount: '2' } : l)) };
assert.equal(prepAmounts(withChili)[3].amount, 2);

// A hot shrub is quicker.
assert.equal(leadText(startPrep('shrub', 'Plum shrub', true).leadMinutes), 'Start an hour ahead');

// Rich syrup comes out near the real batch (1130 ml from 1 kg sugar, 500 ml water).
const rich = startPrep('rich', 'Rich syrup');
assert.deepEqual(prepAmounts(rich).map((a) => a.amount), [1000, 500]);
assert.equal(prepYield(rich), 1120);

// A cordial's acid is a percentage of the juice.
const cordial = startPrep('cordial', 'Lime cordial');
assert.equal(cordial.lines[0].name, 'Lime juice');
assert.deepEqual(prepAmounts(cordial).map((a) => a.amount), [500, 500, 10]);
assert.equal(partsText(0.02, 1), '2% of the base');
assert.equal(partsText(1, 1), '1 part');
assert.equal(partsText(2, 1), '2 parts');

// Super juice per gram of peel.
assert.deepEqual(prepAmounts(startPrep('super', 'Lime super juice')).map((a) => a.amount), [60, 39.6, 19.8, 1000.2]);

// Every kind starts with at least one line, and blank keeps no method.
for (const k of PREP_KINDS) assert.ok(startPrep(k.id, 'Test').lines.length >= 1, k.id);
assert.deepEqual(startPrep('other', 'Smoked salt').steps, []);
assert.equal(leadText(null), null);
assert.equal(leadText(15), 'Takes 15 min');

// The draft is plain JSON (it's stored with the drink's draft).
assert.deepEqual(JSON.parse(JSON.stringify(shrub)), shrub);

// From a library technique: its base and parts are the recipe.
const fromAgar = prepFromTechnique(
  { id: 'agar-quick', base: { name: 'Juice', unit: 'g', amounts: [250, 400, 1000] }, parts: [{ name: 'Agar', per: 0.002, unit: 'g' }, { name: 'Water', per: 0.25, unit: 'ml' }] },
  'Clarified grapefruit',
  { steps: [{ body: 'For 400 g juice: 0.8 g agar, 100 ml water.', timer_seconds: null }, { body: 'Boil the agar in the water.', timer_seconds: 60 }], leadMinutes: 45, actions: ['Clarify'] },
);
assert.deepEqual(prepAmounts(fromAgar).map((a) => a.amount), [400, 0.8, 100]);
assert.deepEqual(fromAgar.steps.map((s) => s.body), ['Boil the agar in the water.'], 'the "For 400 g" line is the recipe now');
assert.equal(fromAgar.technique, 'agar-quick');
assert.equal(prepFromTechnique({ id: 'smoke' }, 'Smoked salt', { steps: [{ body: 'Smoke it.', timer_seconds: null }], leadMinutes: 10, actions: ['Infuse'] }).steps.length, 1);

// Technique words come out of a name: what follows them is one thing, the base.
assert.deepEqual(flavourWords('coconut fat washed white rum'), ['Coconut', 'White rum']);
assert.deepEqual(flavourWords('Chamomile infused gin'), ['Chamomile', 'Gin']);
assert.deepEqual(startPrep('other', 'coconut fat washed white rum').lines.map((l) => l.name), ['Coconut', 'White rum']);
assert.equal(guessKind('Gentian tincture'), null, 'a tincture is its own technique, not an infusion');
assert.equal(guessKind('House bitters'), null);
// An infusion keeps the safer 2 weeks cold, and takes its spirit from the name.
const chamomile = startPrep('infusion', 'Chamomile infused gin');
assert.deepEqual(chamomile.lines.map((l) => l.name), ['Gin', 'Chamomile']);
assert.equal(chamomile.keepsHours, 14 * 24);
assert.equal(chamomile.storage, 'Fridge, sealed bottle');
assert.deepEqual(openSlots(startPrep('infusion', 'Infusion')).map((l) => l.slot), ['spirit', 'flavour']);

// Fat wash from a typed name: White rum the base, coconut the flavour and Coconut Oil the fat, lifted off so it isn't in the yield.
const t = (id: string) => techniqueById(id)!;
const fromTech = (id: string, name: string, picked?: Parameters<typeof prepFromTechnique>[3]) => prepFromTechnique(t(id), name, prepCardFor(t(id)), picked);
assert.deepEqual(nameParts('coconut fat washed white rum', t('fat-wash')), { base: 'White rum', adjunct: 'Coconut', extra: [] });
assert.deepEqual(nameParts('Brown butter bourbon', t('fat-wash')), { base: 'Bourbon', adjunct: 'Brown butter', extra: [] });
const coconut = fromTech('fat-wash', 'coconut fat washed white rum');
assert.deepEqual(coconut.lines.map((l) => l.name), ['White rum', 'Coconut Oil'], 'the fat stirred in is coconut oil, not the fruit');
assert.deepEqual(prepAmounts(coconut).map((a) => a.amount), [750, 60]);
assert.equal(prepYield(coconut), 750, 'the fat is lifted off: makes about what the spirit was');
assert.equal(coconut.keepsHours, 7 * 24, 'coconut is treated like a nut wash: the shorter keep');
assert.deepEqual(coconut.allergens, []);
assert.equal(coconut.vegan, true, 'coconut oil is vegan and not dairy');
assert.equal(openSlots(coconut).length, 0);
const bacon = fromTech('fat-wash', 'Bacon bourbon');
assert.equal(bacon.keepsHours, 14 * 24);
assert.deepEqual(bacon.contains, ['Pork']);
assert.equal(bacon.vegan, false);
const butter = fromTech('fat-wash', 'Brown butter rum');
assert.deepEqual(butter.allergens, ['milk']);
assert.equal(butter.keepsHours, 7 * 24);
assert.ok(butter.lines.find((l) => l.name === 'Brown Butter')?.removed);
// Each flavour word means a real catalog fat or milk in its slot; the name keeps the flavour.
const fat = (name: string) => fromTech('fat-wash', name).lines[1].name;
assert.equal(fat('Butter-washed rum'), 'Butter');
assert.equal(fat('Bacon bourbon'), 'Bacon Fat');
assert.equal(fat('Olive oil washed gin'), 'Olive Oil');
assert.equal(fat('Sesame fat-washed vodka'), 'Sesame Oil');
assert.equal(fat('Duck fat washed cognac'), 'Duck Fat');
assert.equal(fat('Peanut butter washed bourbon'), 'Peanut Butter');
assert.equal(fat('Ghee washed rum'), 'Ghee');
assert.equal(fat('Coconut and pistachio fat-washed rum'), 'Coconut and pistachio', 'two things stay as typed');
assert.equal(nameParts('coconut fat washed white rum', t('fat-wash')).adjunct, 'Coconut');
assert.equal(nameFor(t('fat-wash'), { base: 'White rum', adjunct: 'Coconut' }), 'Coconut fat-washed White rum');
assert.equal(fromTech('milk-wash', 'Yogurt washed gin').lines[1].name, 'Yogurt');
assert.equal(fromTech('milk-wash', 'Greek yoghurt washed gin').lines[1].name, 'Greek Yoghurt');
assert.equal(fromTech('milk-wash', 'Milk washed gin').lines[1].name, 'Whole milk');
assert.equal(fromTech('vegan-wash', 'Coconut milk washed rum').lines[1].name, 'Coconut Milk');
assert.deepEqual(fromTech('vegan-wash', 'Oat milk washed gin').lines.map((l) => l.name), ['Gin', 'Oat Milk']);
assert.equal(slotIngredient('flavour', 'coconut'), null, 'only fat and milk slots map');
assert.equal(fromTech('milk-wash', 'Whey washed rum').lines[1].name, 'Whey');
// A picked "with what" is used as picked, never remapped.
assert.equal(fromTech('fat-wash', 'Coconut fat-washed rum', { adjunct: { id: 'c1', name: 'Coconut' } }).lines[1].name, 'Coconut');
// A picked bottle is the base, by id, and is what it's made from.
const bacardi = fromTech('fat-wash', 'Coconut fat-washed rum', { base: { id: 'b1', name: 'Bacardí Carta Blanca' } });
assert.deepEqual({ id: bacardi.lines[0].id, name: bacardi.lines[0].name }, { id: 'b1', name: 'Bacardí Carta Blanca' });
assert.deepEqual(bacardi.madeFrom, { id: 'b1', name: 'Bacardí Carta Blanca' });
assert.equal(nameFor(t('fat-wash'), { base: 'Bacardí Carta Blanca', adjunct: 'Coconut' }), 'Coconut fat-washed Bacardí Carta Blanca');
assert.equal(nameFor(t('milk-wash'), { base: 'gin' }), 'Milk-washed gin');
assert.equal(nameFor(t('milk-wash'), { base: 'gin', adjunct: 'Yogurt' }), 'Yogurt-washed gin');
assert.equal(nameFor(t('infused-oil'), { base: 'Mint' }), 'Mint oil');
// A picked "with what" fills the fat.
const peanut = fromTech('fat-wash', 'Fat-washed rum', { adjunct: { id: 'pb', name: 'Peanut butter' } });
assert.equal(peanut.lines[1].id, 'pb');
assert.deepEqual(peanut.allergens, ['peanuts'], 'peanut butter is peanut, not milk');

// Stand-ins: nothing named, so the spirit and the fat are to pick, and the builder can't finish.
const blankWash = fromTech('fat-wash', 'Fat wash');
assert.deepEqual(openSlots(blankWash).map((l) => l.name), ['Spirit', 'Melted fat']);
assert.equal(slotMessage(blankWash), 'Pick the spirit and the fat, or take them out, to go on.');
assert.equal(blankWash.vegan, null, 'nobody can say until the fat is picked');
assert.equal(slotMessage(coconut), null);
const picked = withFacts({ ...blankWash, lines: blankWash.lines.map((l) => (l.slot === 'fat' ? { ...l, name: 'Butter', slot: undefined } : l.slot ? { ...l, name: 'Rum', slot: undefined } : l)) });
assert.deepEqual(picked.allergens, ['milk']);
assert.equal(picked.vegan, false);

// Herb oil: herb 1 to oil 1.5 by weight, 4 days cold, the safety gate with it.
const mint = fromTech('infused-oil', 'Mint oil');
assert.deepEqual(mint.lines.map((l) => [l.name, l.parts]), [['Mint', 1], ['Neutral oil', 1.5]]);
assert.equal(mint.keepsHours, 4 * 24);
assert.equal(keepsText(mint), '4 days');
assert.equal(mint.storage, 'Fridge, sealed bottle');
assert.equal(mint.gate, 'safety');
assert.deepEqual(mint.equipment, ['blender']);

// Keeps in minutes and in years; storage airtight.
const air = fromTech('lecithin-air', 'Grapefruit air');
assert.equal(air.keepsHours, null, 'shelf_life_hours is whole hours: an air keeps minutes');
assert.equal(air.keepsMinutes, 5);
assert.equal(keepsText(air), '5 min');
assert.deepEqual(air.allergens, ['soya']);
const tincture = fromTech('tincture', 'Gentian tincture');
assert.equal(keepsText(tincture), '1 year');
assert.equal(tincture.storage, 'Ambient, dark');
assert.deepEqual(openSlots(tincture).map((l) => l.slot), ['high-proof neutral spirit'], 'a tincture needs strong neutral spirit, picked');
assert.equal(fromTech('dehydrated-citrus', 'Dried orange wheels').storage, 'Airtight, dry');
assert.equal(fromTech('kombucha', 'Ginger kombucha').keepsHours, 2 * 24, 'flavoured kombucha: 2 days');
assert.equal(fromTech('kombucha', 'Kombucha').keepsHours, 30 * 24);

// Milk wash: the acid that breaks the milk is in the recipe; the curds aren't in the yield.
const punch = fromTech('milk-wash', 'Clarified rum');
assert.deepEqual(punch.lines.map((l) => l.name), ['Rum', 'Whole milk', 'Lemon juice']);
assert.equal(prepYield(punch), 1000);
assert.deepEqual(punch.allergens, ['milk']);
// Reverse spheres: the flavour liquid is the base; the bath is poured away.
const spheres = fromTech('reverse-spheres', 'Campari spheres');
assert.equal(spheres.lines[0].name, 'Campari');
assert.ok(spheres.lines.filter((l) => l.removed).length === 2);
// The centrifuge's chitosan is shellfish, unless it's fungal.
assert.deepEqual(prepFacts(['Chitosan']).allergens, ['crustaceans']);
assert.deepEqual(prepFacts(['Fungal chitosan']).allergens, []);
assert.deepEqual(prepFacts(['Almond milk']).allergens, ['tree_nuts']);
assert.deepEqual(prepFacts(['Coconut milk']).allergens, []);
assert.equal(prepFacts(['Honey']).vegan, false);
assert.equal(prepFacts(['Agave']).vegan, true);
// Quick pickles: the brine is the recipe (1 cup vinegar, 1 cup water, 1 tbsp salt, 2 tsp sugar).
assert.deepEqual(prepAmounts(fromTech('quick-pickle', 'Cocktail onions')).map((a) => a.amount), [480, 480, 6, 4, null]);
// Every template is plain JSON and its slots are the only stand-ins.
for (const tech of [t('fat-wash'), t('milk-wash'), t('nitrous-infusion'), t('cold-infusion'), t('tincture'), t('orgeat')]) {
  const d = fromTech(tech.id, tech.name);
  assert.deepEqual(JSON.parse(JSON.stringify(d)), JSON.parse(JSON.stringify(d)));
  for (const l of d.lines) if (/^(spirit|melted fat|solids|batch|flavour)$/i.test(l.name)) assert.ok(l.slot, `${tech.id}: ${l.name} is a stand-in`);
}
console.log('prepKinds technique checks passed');
