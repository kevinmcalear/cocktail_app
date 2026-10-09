// Checks for lib/techniques. Run: npm run test:unit
import assert from 'node:assert/strict';

import { PREP_ACTIONS } from '../scale';
import { pickFoam } from './foamPicker';
import {
  canMake, EQUIPMENT, formatDose, groupForAction, GROUPS, scaleParts, searchTechniques, technicalIngredientFor,
  TECHNICAL_INGREDIENTS, techniqueById, TECHNIQUES, unlocks,
} from './index';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.02, `expected ${b}, got ${a}`);

// Ids are unique, every reference resolves, every group has something in it.
const ids = TECHNIQUES.map((t) => t.id);
assert.equal(new Set(ids).size, ids.length, 'technique ids are unique');
assert.equal(new Set(EQUIPMENT.map((e) => e.id)).size, EQUIPMENT.length, 'equipment ids are unique');
const kit = new Set(EQUIPMENT.map((e) => e.id));
for (const t of TECHNIQUES) {
  for (const e of [...t.equipment, ...(t.helpful ?? [])]) assert.ok(kit.has(e), `${t.id} uses unknown equipment ${e}`);
  assert.ok(GROUPS.some((g) => g.id === t.group), `${t.id} has a known group`);
  assert.ok(t.sources.length, `${t.id} cites a source`);
  assert.ok(t.steps.length, `${t.id} has steps`);
  if (t.parts) assert.ok(t.base, `${t.id} has parts, so it needs a base to scale from`);
}
for (const g of GROUPS) assert.ok(TECHNIQUES.some((t) => t.group === g.id), `${g.id} has techniques`);
for (const i of TECHNICAL_INGREDIENTS) for (const t of i.techniques) assert.ok(techniqueById(t), `${i.id} links to unknown ${t}`);

// Every source is a link, and nothing anywhere uses an em dash.
const text = JSON.stringify([TECHNIQUES, EQUIPMENT, TECHNICAL_INGREDIENTS]);
assert.ok(!text.includes('\u2014'), 'no em dashes in the library');
for (const t of [...TECHNIQUES, ...TECHNICAL_INGREDIENTS]) for (const s of t.sources) assert.match(s.url, /^https?:\/\//);

// Prep card tags lead somewhere for every action that is a technique.
for (const a of ['Clarify', 'Fat wash', 'Infuse', 'Carbonate', 'Ferment', 'Sous vide', 'Milk wash', 'Foam']) assert.ok(groupForAction(a), a);
assert.ok(PREP_ACTIONS.includes('Milk wash' as never) && PREP_ACTIONS.includes('Foam' as never), 'prep editor offers the new tags');
assert.equal(groupForAction('Strain'), undefined);

// Scaling: quick agar for 375 g juice is 125 g water and 1 g agar (0.2% of the 500 g mix).
const agar = techniqueById('agar-quick')!;
const parts = scaleParts(agar.parts!, 375);
near(parts.find((p) => p.name === 'Water')!.amount, 125);
near(parts.find((p) => p.name === 'Agar')!.amount, 1);
near(scaleParts(techniqueById('milk-wash')!.parts!, 1000)[0].amount, 250);
assert.deepEqual(scaleParts(agar.parts!, 0), []);

// Small doses keep their decimals.
assert.equal(formatDose(0.05), '0.05');
assert.equal(formatDose(1.0667), '1.07');
assert.equal(formatDose(133.3), '133');
assert.equal(formatDose(12.34), '12.3');
assert.equal(formatDose(0.001), '<0.01');

// Search matches other names; kit decides what you can make.
assert.ok(searchTechniques('milk punch').some((t) => t.id === 'milk-wash'));
assert.ok(searchTechniques('spinzall').some((t) => t.id === 'centrifuge'));
assert.equal(searchTechniques('').length, TECHNIQUES.length);
assert.equal(canMake(techniqueById('centrifuge')!, new Set(['scale-fine'])), false);
assert.equal(canMake(techniqueById('centrifuge')!, new Set(['scale-fine', 'centrifuge'])), true);
assert.ok(unlocks('whipper', new Set(['scale-fine'])) >= 2, 'a whipper opens siphon foams and nitrous infusion');

// Technical ingredients match catalog names whole.
assert.equal(technicalIngredientFor('Xanthan Gum')?.id, 'xanthan');
assert.equal(technicalIngredientFor('  agar-agar ')?.id, 'agar');
assert.equal(technicalIngredientFor('Xanthan gum syrup'), undefined);

// Foam from anything.
const veganSour = pickFoam({ kind: 'shaken', fat: false, strong: false, diet: 'vegan' });
assert.ok(veganSour.ruledOut.some((r) => r.agent.id === 'egg' && r.why === 'Not vegan'));
assert.ok(veganSour.works.some((a) => a.id === 'aquafaba'));
const fatty = pickFoam({ kind: 'siphon', fat: true, strong: false, diet: 'none' });
assert.deepEqual(new Set(fatty.works.map((a) => a.id)), new Set(['gelatin', 'cream', 'sucro']));
const strongAir = pickFoam({ kind: 'air', fat: false, strong: true, diet: 'none' });
assert.equal(strongAir.works[0].id, 'sucro');
assert.ok(strongAir.note);
assert.equal(pickFoam({ kind: 'shaken', fat: false, strong: true, diet: 'none' }).note, null, 'strength only matters for a separate foam');
assert.ok(pickFoam({ kind: 'shaken', fat: false, strong: false, diet: 'no-soy' }).ruledOut.some((r) => r.agent.id === 'versawhip'));

console.log('techniques.check: ok');
