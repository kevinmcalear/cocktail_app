// Checks for lib/runSheet.ts with the boards' numbers (canvas 7KusjjZLGZjbFd3B7oamZU):
// Penicillin 120, Negroni 200, Tokyo Collins 80, Americano 150, Martini 60 = 610
// serves; gin 13.2 L = 19 × 700 ml. Run: npm run test:unit
import assert from 'node:assert/strict';

import { MAX_SERVES } from './batch';
import type { HouseMade, SpecLine } from './prep';
import { buildRunSheet, clampServes, needGroups, pourSuggestions, type ItemFacts, type RunDrink, type RunSheetInput, type RunSwap } from './runSheet';

const line = (ingredientId: string, name: string, amount: number, unit = 'ml'): SpecLine => ({ ingredientId, name, amount, unit });
const rocks = { id: 'rocks', name: 'Rocks glass' };
const highball = { id: 'highball', name: 'Highball' };
const large = { id: 'large', name: 'Large cube' };
const cubes = { id: 'cubes', name: 'Cubes' };
const drink = (id: string, name: string, serves: number | null, recipe: SpecLine[], extra: Partial<RunDrink> = {}): RunDrink => ({
  id, itemId: `item-${id}`, name, itemType: 'cocktail', serves, recipe, glass: null, ice: null, icePerServeG: null, partyId: null, ...extra,
});

const drinks: RunDrink[] = [
  drink('pen', 'Penicillin', 120, [line('scotch', 'Blended Scotch', 60), line('lemon', 'Lemon juice', 22.5), line('hgs', 'Honey-ginger syrup', 22.5), line('islay', 'Islay Scotch', 7.5), line('ginger', 'Candied ginger', 1, 'each')], { glass: rocks, ice: large, partyId: 'rye' }),
  drink('neg', 'Negroni', 200, [line('gin', 'London dry gin', 30), line('campari', 'Campari', 30), line('sweet', 'Sweet vermouth', 30), line('twist', 'Orange twist', 1, 'each')], { glass: rocks, ice: large }),
  drink('tokyo', 'Tokyo Collins', 80, [line('gin', 'London dry gin', 45), line('lemon', 'Lemon juice', 22.5), line('gf', 'Grapefruit juice', 30), line('sugar', 'Sugar syrup', 15), line('soda', 'Soda water', 60), line('wedge', 'Grapefruit wedge', 1, 'each')], { glass: highball, ice: cubes, icePerServeG: 650 }),
  drink('amer', 'Americano', 150, [line('campari', 'Campari', 30), line('sweet', 'Sweet vermouth', 30), line('soda', 'Soda water', 90), line('wheel', 'Orange wheel', 1, 'each')], { glass: highball, ice: cubes, icePerServeG: 650 }),
  drink('mart', 'Martini', 60, [line('gin', 'London dry gin', 60), line('dry', 'Dry vermouth', 15), line('lt', 'Lemon twist', 1, 'each')], { glass: { id: 'nn', name: 'Nick & Nora' } }),
];

const spirit = (extra: Partial<ItemFacts> = {}): ItemFacts => ({ makerProfileId: null, role: 'product', abv: 40, kind: null, genericId: null, ...extra });
const items: Record<string, ItemFacts> = {
  gin: spirit({ role: 'generic', genericId: 'gin-style', kind: 'Gin' }),
  millash: spirit({ makerProfileId: 'maker-mill', genericId: 'gin-style', kind: 'Gin' }),
  hbs: spirit({ makerProfileId: 'maker-harbour', kind: 'Scotch' }),
  hislay: spirit({ makerProfileId: 'maker-harbour', kind: 'Scotch' }),
  campari: spirit({ abv: 25 }),
  sweet: spirit({ abv: 16 }),
  dry: spirit({ abv: 18 }),
};

const houseMade: Record<string, HouseMade> = {
  hgs: { recipe: [line('honey', 'Honey', 500, 'g'), line('gingerjuice', 'Ginger juice', 250)], yieldAmount: 1, yieldUnit: 'l', leadTimeMinutes: null, leadTimeNote: null, shelfLifeHours: 336 },
  sugar: { recipe: [line('caster', 'Caster sugar', 500, 'g')], yieldAmount: 1, yieldUnit: 'l', leadTimeMinutes: null, leadTimeNote: null, shelfLifeHours: null },
  ginger: { recipe: [], yieldAmount: null, yieldUnit: null, leadTimeMinutes: null, leadTimeNote: null },
};

const pack = (ml: number) => ({ supplierName: null, packAmount: ml, packUnit: 'ml' });
const swaps: RunSwap[] = [
  { menuDrinkId: 'pen', fromItemId: 'scotch', toItemId: 'hbs', toName: 'Harbour Blended Scotch' },
  { menuDrinkId: 'pen', fromItemId: 'islay', toItemId: 'hislay', toName: 'Harbour Islay' },
  { menuDrinkId: 'neg', fromItemId: 'twist', toItemId: 'bot', toName: 'Blood orange twist' },
];

// "Pour Mill & Ash Gin everywhere?": gin shows up in 3 drinks.
const bottles = [{ id: 'millash', name: 'Mill & Ash Gin', genericId: 'gin-style', kindName: 'Gin', partyId: 'mill' }];
const [suggestion] = pourSuggestions(drinks, swaps, items, bottles);
assert.equal(suggestion.drinkCount, 3);
assert.deepEqual(suggestion.swaps.map((s) => s.menuDrinkId), ['neg', 'tokyo', 'mart']);
for (const s of suggestion.swaps) swaps.push({ ...s, toItemId: 'millash', toName: 'Mill & Ash Gin' });
assert.deepEqual(pourSuggestions(drinks, swaps, items, bottles), [], 'once poured everywhere, nothing left to suggest');

const input: RunSheetInput = {
  hostName: "Caretaker's Cottage",
  drinks,
  swaps,
  parties: [
    { id: 'mill', kind: 'brand', name: 'Mill & Ash Gin', profileId: 'maker-mill' },
    { id: 'rye', kind: 'guest', name: 'Little Rye', profileId: 'bar-rye' },
    { id: 'harbour', kind: 'brand', name: 'Harbour Scotch', profileId: 'maker-harbour' },
  ],
  owners: {},
  houseMade,
  purchasing: { millash: pack(700), hbs: pack(700), hislay: pack(700), campari: pack(700), sweet: pack(1000), dry: pack(1000) },
  items,
  breakDownPreps: false,
};
const sheet = buildRunSheet(input);
const need = (name: string) => {
  const found = sheet.groups.flatMap((g) => g.needs).find((n) => n.name === name);
  assert.ok(found, name);
  return found;
};
const row = (name: string) => [need(name).amount, need(name).detail, need(name).group];

assert.equal(sheet.totalServes, 610);
assert.deepEqual(row('Mill & Ash Gin'), ['13.2 L', 'buy 19 × 700 ml', 'spirits']);
assert.deepEqual(row('Harbour Blended Scotch'), ['7.2 L', 'buy 11 × 700 ml', 'spirits']);
assert.deepEqual(row('Harbour Islay'), ['900 ml', 'buy 2 × 700 ml', 'spirits']);
assert.deepEqual(row('Campari'), ['10.5 L', 'buy 15 × 700 ml', 'spirits']);
assert.deepEqual(row('Sweet vermouth'), ['10.5 L', 'buy 11 × 1 L', 'spirits']);
assert.deepEqual(row('Dry vermouth'), ['900 ml', 'buy 1 × 1 L', 'spirits']);
assert.deepEqual(row('Lemon juice'), ['4.5 L', 'about 110 lemons', 'fresh']);
assert.deepEqual(row('Grapefruit juice'), ['2.4 L', 'about 16 grapefruit', 'fresh']);
assert.deepEqual(row('Honey-ginger syrup'), ['2.7 L', 'keeps 14 days', 'preps']);
assert.deepEqual(row('Sugar syrup'), ['1.2 L', null, 'preps']);
assert.deepEqual(row('Soda water'), ['18.3 L', null, 'mixers']);
assert.deepEqual(row('Blood orange twist'), ['200', null, 'garnish']);
assert.deepEqual(row('Candied ginger'), ['120', null, 'garnish']);
assert.deepEqual(row('Rocks glass'), ['320', 'Penicillin, Negroni', 'glassware']);
assert.deepEqual(row('Highball'), ['230', 'Tokyo Collins, Americano', 'glassware']);
assert.deepEqual(row('Cubes'), ['about 150 kg', null, 'ice']);
assert.deepEqual(row('Large cube'), ['320', null, 'ice']);
assert.equal(sheet.groups.flatMap((g) => g.needs).some((n) => n.name === 'London dry gin'), false, 'swapped out everywhere');
assert.deepEqual(sheet.groups.map((g) => g.title), ['Spirits and liqueurs', 'Juices and fresh', 'House-made', 'Mixers', 'Garnish', 'Glassware', 'Ice']);

// Extra for testing and tasting scales what's made and bought, rounded up to whole bottles and garnish; serves, glasses and ice stay.
const extra = buildRunSheet({ ...input, marginPct: 10 });
const extraNeed = (name: string) => extra.groups.flatMap((g) => g.needs).find((n) => n.name === name)!;
assert.equal(extra.marginPct, 10);
assert.deepEqual([extraNeed('Mill & Ash Gin').amount, extraNeed('Mill & Ash Gin').detail], ['14.5 L', 'buy 21 × 700 ml']);
assert.deepEqual([extraNeed('Candied ginger').amount, extraNeed('Rocks glass').amount, extraNeed('Large cube').amount], ['132', '320', '320']);
assert.equal(extra.totalServes, 610);
assert.equal(extra.drinks[0].lines[0].total, '7.2 L', 'the drink specs stay per serve as counted');
assert.equal(sheet.marginPct, 0, 'no margin unless asked');
// A spirit with no bottle size set: the usual 700 ml, said as assumed.
const noSize = buildRunSheet({ ...input, purchasing: {} });
assert.equal(noSize.groups.flatMap((g) => g.needs).find((n) => n.name === 'Sweet vermouth')!.detail, 'buy 15 × 700 ml (700 ml assumed)');
assert.equal(noSize.groups.flatMap((g) => g.needs).find((n) => n.name === 'Soda water')!.detail, null, 'only spirits count in bottles');

// Each party's part keeps the step 3 groups, and its logo.
const withLogos = buildRunSheet({ ...input, hostLogoUrl: 'https://x/cottage.png', parties: input.parties.map((p) => (p.id === 'rye' ? { ...p, logoUrl: 'https://x/rye.png' } : p)) });
assert.deepEqual(withLogos.parties.map((p) => p.logoUrl), ['https://x/cottage.png', 'https://x/rye.png', null, null]);
assert.deepEqual(needGroups(sheet.parties[0].needs).map((g) => g.title), ['Spirits and liqueurs', 'Juices and fresh', 'House-made', 'Mixers', 'Garnish', 'Glassware', 'Ice']);

// Default owners: the brand that makes the bottle, the visiting bar for their drink's house preps, the bar it's at for the rest.
const counts = sheet.parties.map((p) => [p.name, p.role, p.needs.length]);
assert.deepEqual(counts, [["Caretaker's Cottage", 'Venue', 16], ['Little Rye', 'Visiting team', 2], ['Mill & Ash Gin', 'Brand', 1], ['Harbour Scotch', 'Brand', 2]]);
assert.deepEqual(sheet.parties[1].needs.map((n) => n.name), ['Honey-ginger syrup', 'Candied ginger']);
assert.equal(need('Sugar syrup').ownerId, null, "the host's drink, the host's syrup");

// At their bar (we're visiting Little Rye): it comes first and has everything,
// except the house preps for our own drinks, which we bring, and the brands' bottles.
const theirBar = input.parties.map((p) => (p.kind === 'guest' ? { ...p, isVenue: true } : p));
const away = buildRunSheet({ ...input, parties: theirBar });
assert.deepEqual(away.parties.map((p) => [p.name, p.role, p.needs.length]), [['Little Rye', 'Venue', 17], ["Caretaker's Cottage", 'Visiting team', 1], ['Mill & Ash Gin', 'Brand', 1], ['Harbour Scotch', 'Brand', 2]]);
assert.deepEqual(away.parties[1].needs.map((n) => n.name), ['Sugar syrup'], 'our Tokyo Collins, our syrup');
const awayNeed = (name: string) => away.groups.flatMap((g) => g.needs).find((n) => n.name === name)!;
assert.deepEqual([awayNeed('Honey-ginger syrup').ownerId, awayNeed('Campari').ownerId, awayNeed('Rocks glass').ownerId], ['rye', 'rye', 'rye']);
assert.equal(buildRunSheet({ ...input, parties: theirBar, owners: { campari: null } }).groups.flatMap((g) => g.needs).find((n) => n.name === 'Campari')!.ownerId, null, 'a pick of us still means us');

// The drinks, as swapped for this menu.
const pen = sheet.drinks[0];
assert.deepEqual(pen.lines.map((l) => [l.name, l.per, l.total]), [
  ['Harbour Blended Scotch', '60 ml', '7.2 L'], ['Lemon juice', '22.5 ml', '2.7 L'], ['Honey-ginger syrup', '22.5 ml', '2.7 L'], ['Harbour Islay', '7.5 ml', '900 ml'], ['Candied ginger', '1', '120'],
]);
assert.deepEqual(pen.lines[0].was, { id: 'scotch', name: 'Blended Scotch' });
assert.equal(pen.serve, 'Rocks glass · Large cube · Candied ginger');

// Picked owners win; one for a party that's gone falls back to the host; null is the host.
const picked = buildRunSheet({ ...input, owners: { campari: 'rye', millash: null, dry: 'deleted-party' } });
const pickedNeed = (name: string) => picked.groups.flatMap((g) => g.needs).find((n) => n.name === name)!;
assert.deepEqual([pickedNeed('Campari').ownerId, pickedNeed('Campari').picked], ['rye', true]);
assert.equal(pickedNeed('Mill & Ash Gin').ownerId, null);
assert.equal(pickedNeed('Dry vermouth').ownerId, null);

// Breaking house preps down: whole batches of what they're made from, owned like the prep.
const broken = buildRunSheet({ ...input, breakDownPreps: true });
const brokenNeed = (name: string) => broken.groups.flatMap((g) => g.needs).find((n) => n.name === name)!;
assert.equal(brokenNeed('Honey-ginger syrup').detail, '3 batches of 1 L · keeps 14 days');
assert.deepEqual([brokenNeed('Honey').amount, brokenNeed('Honey').ownerId, brokenNeed('Honey').forDrinks], ['1.5 kg', 'rye', ['Penicillin']]);
assert.deepEqual([brokenNeed('Caster sugar').amount, brokenNeed('Caster sugar').ownerId], ['1 kg', null]);

// Drinks without serves add nothing; beer counts as itself.
const quiet = buildRunSheet({ ...input, drinks: [drink('m2', 'Martini', null, drinks[4].recipe), drink('ale', 'Pale ale', 48, [], { itemType: 'beer' })] });
assert.equal(quiet.totalServes, 48);
assert.deepEqual(quiet.groups.map((g) => [g.title, g.needs.map((n) => [n.name, n.amount])]), [['Beer and wine', [['Pale ale', '48']]]]);

// A drink made in parts (an Irish Coffee): its lines under numbered parts, a swap keeping its line's part.
const partLine = (ingredientId: string, name: string, amount: number, part: number): SpecLine => ({ ...line(ingredientId, name, amount), part });
const irish = drink('irish', 'Irish Coffee', 40, [partLine('whiskey', 'Irish whiskey', 40, 1), partLine('coffee', 'Hot coffee', 120, 1), partLine('cream', 'Cream', 30, 2)], {
  parts: [{ name: 'The coffee' }, { name: 'The cream', join: 'float' }],
});
const inParts = buildRunSheet({ ...input, drinks: [irish], swaps: [{ menuDrinkId: 'irish', fromItemId: 'cream', toItemId: 'jersey', toName: 'Jersey cream' }] }).drinks[0];
assert.deepEqual(inParts.parts?.map((p) => [p.n, p.name, p.joins, p.lines.map((l) => [l.name, l.total])]), [
  [1, 'The coffee', null, [['Irish whiskey', '1.6 L'], ['Hot coffee', '4.8 L']]],
  [2, 'The cream', 'Float on top', [['Jersey cream', '1.2 L']]],
]);
assert.equal(inParts.lines.length, 3, 'every line still totals');
assert.equal(sheet.drinks[0].parts, null, 'a drink in one part reads as it always has');

// Serves: whole numbers from 1 to 6,969.
assert.equal(clampServes('120'), 120);
assert.equal(clampServes('7,000'), MAX_SERVES);
assert.equal(clampServes(0), null);
assert.equal(clampServes(''), null);
assert.equal(clampServes(2.7), 2);

console.log('runSheet checks passed');
