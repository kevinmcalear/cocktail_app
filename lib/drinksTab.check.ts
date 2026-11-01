// Checks for lib/drinksTab.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { bottleKind, bottleLine, capsuleChips, capsuleOf, countText, fridgeRows, homeCapsule, homeRows, homeStyle, isLow, lowLine, onNowSub, orderSummary, orderText, serviceTag } from './drinksTab';
import { filterGroups } from './libraryFilters';

// Capsules: House-made is Preps; Bottles everything bought; the rest is Drinks.
assert.equal(capsuleOf('preps'), 'house');
assert.equal(capsuleOf('bottles'), 'bottles');
assert.equal(capsuleOf('garnishes'), 'bottles');
assert.equal(capsuleOf('needs-price'), 'bottles');
assert.equal(capsuleOf('staff'), 'drinks');
assert.equal(capsuleOf('ready'), 'drinks');
{
  const groups = filterGroups(true, true);
  const drinks = capsuleChips(groups, 'drinks')
    .flat()
    .map((f) => f.value);
  assert.deepEqual(drinks, ['all', 'on-menu', 'staff', 'past', 'rnd', 'batched', 'ready', 'needs', 'cocktails', 'beer', 'wine']);
  assert.deepEqual(
    capsuleChips(groups, 'bottles')
      .flat()
      .map((f) => f.value),
    ['garnishes', 'bottles', 'needs-price']
  );
  assert.deepEqual(
    capsuleChips(groups, 'house')
      .flat()
      .map((f) => f.value),
    ['preps']
  );
}
assert.equal(homeCapsule('shelf'), 'shelf');
assert.equal(homeCapsule(['menus']), 'menus');
assert.equal(homeCapsule('nonsense'), 'drinks');
assert.equal(homeCapsule(undefined), 'drinks');

// Tags.
assert.equal(serviceTag(['sulphites', 'eggs']), 'Egg');
assert.equal(serviceTag(['tree_nuts']), 'Nuts');
assert.equal(serviceTag(['sulphites']), null);

// On now.
assert.equal(onNowSub(8, { name: 'Winter', startsAt: '2026-12-01T17:00:00Z' }, 'en-GB'), '8 drinks · Winter on 1 Dec');
assert.equal(onNowSub(1, null), '1 drink');
assert.equal(onNowSub(3, { name: 'Draft', startsAt: null }), '3 drinks');

// In the fridge: the newest batch per house-made, soonest first, gone ones out.
{
  const now = new Date(2026, 10, 10, 15); // Tue 10 Nov
  const at = (day: number) => new Date(2026, 10, day, 12).toISOString();
  const names: Record<string, string> = { hg: 'Honey-ginger syrup', oleo: 'Oleo saccharum', saline: 'Saline 20%', old: 'Old cordial' };
  const rows = fridgeRows(
    [
      { id: '1', itemId: 'hg', amount: 600, unit: 'ml', madeAt: at(6), madeBy: null },
      { id: '2', itemId: 'hg', amount: 1200, unit: 'ml', madeAt: at(9), madeBy: null },
      { id: '3', itemId: 'oleo', amount: 400, unit: 'ml', madeAt: at(7), madeBy: null },
      { id: '4', itemId: 'saline', amount: 100, unit: 'ml', madeAt: at(1), madeBy: null },
      { id: '5', itemId: 'old', amount: 1, unit: 'L', madeAt: at(1), madeBy: null },
      { id: '6', itemId: 'gone', amount: 1, unit: 'L', madeAt: at(9), madeBy: null },
    ],
    { hg: 24 * 5, oleo: 24 * 3, old: 48 },
    (id) => names[id] ?? null,
    now
  );
  assert.deepEqual(
    rows.map((r) => [r.name, r.line, r.today]),
    [
      ['Oleo saccharum', '400 ml · use today', true],
      ['Honey-ginger syrup', '1.2 L · use by Sat 14 Nov', false],
      ['Saline 20%', '100 ml · keeps', false],
    ]
  );
  assert.equal(rows[1].madeDay, 1);
}

assert.equal(lowLine({ have: 'have 200 ml', needed: '1 L', forDrinks: ['Jack Rose'] }), '200 ml · Jack Rose needs it');
assert.equal(lowLine({ have: null, needed: '1 L', forDrinks: ['back to par'] }), 'make 1 L · back to par');

// Bottles.
assert.equal(bottleKind('Plymouth Gin'), 'Gin');
assert.equal(bottleKind('Campari'), 'Amaro & aperitivo');
assert.equal(bottleKind('Simple syrup'), null);
assert.equal(bottleLine('Gin', ['a', 'b', 'c']), 'Gin · in 3 drinks');
assert.equal(bottleLine('Amaro & aperitivo', ['Last Word']), 'Amaro & aperitivo · Last Word');
assert.equal(bottleLine(null, []), null);
assert.equal(countText({ kind: 'count', value: 2, unit: 'bottle' }), '2');
assert.equal(countText({ kind: 'ml', value: 700, unit: 'ml' }), '700 ml');
assert.equal(countText(undefined), null);
assert.ok(isLow({ kind: 'count', value: 0, unit: 'bottle' }, { kind: 'count', value: 2, unit: 'bottle' }));
assert.ok(!isLow(undefined, { kind: 'count', value: 2, unit: 'bottle' }));
assert.ok(!isLow({ kind: 'ml', value: 100, unit: 'ml' }, { kind: 'count', value: 2, unit: 'bottle' }));

// To order.
{
  const line = (name: string, packs: string | null) => ({ id: name, name, needed: '1.5 L', have: null, packs, forDrinks: [], quantities: [] });
  const order = [
    { supplier: 'Southern', lines: [line('Campari', '2 × 1 L'), line('Gin', null)] },
    { supplier: 'Greengrocer', lines: [line('Limes', '1 × 5 kg')] },
    { supplier: 'Nobody', lines: [] },
  ];
  assert.equal(orderSummary(order), '3 things from 2 suppliers');
  assert.equal(orderSummary([]), null);
  assert.equal(orderText(order), 'Southern\nCampari: 2 × 1 L\nGin: 1.5 L\n\nGreengrocer\nLimes: 1 × 5 kg');
}

// Home's style chips.
assert.ok(homeStyle('sours', { id: 'd', name: 'Daiquiri', ingredients: ['White rum', 'Lime juice', 'Simple syrup'], method: 'Shake' }));
assert.ok(!homeStyle('sours', { id: 'n', name: 'Negroni', ingredients: ['Gin', 'Campari', 'Sweet vermouth'], method: 'Stir' }));
assert.ok(homeStyle('stirred', { id: 'n', name: 'Negroni', ingredients: [], method: 'Stir' }));
assert.ok(!homeStyle('stirred', { id: 'd', name: 'Daiquiri', ingredients: [], method: 'Shake' }));

// Home's rows.
{
  const d = (id: string) => ({ id, name: id[0].toUpperCase() + id.slice(1) });
  const src = { make: [d('negroni'), d('daiquiri'), d('negroni')], saved: [d('clover'), d('bee')], ranked: [d('martini'), d('daiquiri')] };
  const facts: Record<string, { ingredients: string[]; method: string | null }> = {
    negroni: { ingredients: ['Gin', 'Campari', 'Sweet vermouth'], method: 'Stir' },
    daiquiri: { ingredients: ['White rum', 'Lime juice', 'Simple syrup'], method: 'Shake' },
    martini: { ingredients: ['Gin', 'Dry vermouth'], method: 'Stir' },
  };
  assert.deepEqual(
    homeRows('make', src, (id) => facts[id]).map((r) => r.id),
    ['negroni', 'daiquiri']
  );
  assert.deepEqual(
    homeRows('saved', src, (id) => facts[id]).map((r) => r.id),
    ['bee', 'clover']
  );
  assert.deepEqual(
    homeRows('stirred', src, (id) => facts[id]).map((r) => r.id),
    ['martini', 'negroni']
  );
  assert.deepEqual(
    homeRows('sours', src, (id) => facts[id]).map((r) => r.id),
    ['daiquiri']
  );
}

console.log('drinksTab checks passed');
