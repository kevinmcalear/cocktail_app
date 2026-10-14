/**
 * A menu's run sheet: each drink's serves, the bottles swapped for this menu
 * only, everything the drinks need totalled and grouped (spirits, juices,
 * house preps, mixers, garnish, glassware, ice), and who brings each thing:
 * the hosting venue, the guest venue or a brand. Pure; hooks/useRunSheet.ts
 * fetches the rows. Totals come from lib/prep.ts buildPrepList.
 * Design: https://claude.ai/artifact/7KusjjZLGZjbFd3B7oamZU
 */

import { barSection, isMixer } from './barSections';
import { isGarnishUnit, MAX_SERVES } from './batch';
import { keepsFor } from './batchPrep';
import { formatIce, iceForEvent } from './glass';
import { buildPrepList, type HouseMade, type Purchasing, type SpecLine } from './prep';
import { formatQuantity, scale, toQuantity, type Quantity } from './quantity';
import { lineHits } from './swapBottle';

/** A typed serves count, as stored: a whole number from 1 to MAX_SERVES (lib/batch.ts, 6,969), or null for none. */
export function clampServes(value: number | string | null | undefined): number | null {
  const n = typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : value;
  if (n == null || !Number.isFinite(n) || n < 1) return null;
  return Math.min(MAX_SERVES, Math.floor(n));
}

export type GroupKey = 'spirits' | 'fresh' | 'preps' | 'mixers' | 'garnish' | 'beerWine' | 'glassware' | 'ice';

export const GROUPS: { key: GroupKey; title: string }[] = [
  { key: 'spirits', title: 'Spirits and liqueurs' },
  { key: 'fresh', title: 'Juices and fresh' },
  { key: 'preps', title: 'House preps' },
  { key: 'mixers', title: 'Mixers' },
  { key: 'garnish', title: 'Garnish' },
  { key: 'beerWine', title: 'Beer and wine' },
  { key: 'glassware', title: 'Glassware' },
  { key: 'ice', title: 'Ice' },
];

export interface RunDrink {
  /** menu_drinks.id */
  id: string;
  itemId: string;
  name: string;
  /** cocktail, beer or wine. Beer and wine count as themselves. */
  itemType: string;
  serves: number | null;
  /** One serve, as the library has it. */
  recipe: SpecLine[];
  glass: { id: string; name: string } | null;
  ice: { id: string; name: string } | null;
  icePerServeG: number | null;
  /** The guest venue's own drink: its house preps default to the guest. */
  byGuest: boolean;
}

export interface RunSwap {
  menuDrinkId: string;
  fromItemId: string;
  toItemId: string;
  toName: string;
}

export interface RunParty {
  id: string;
  kind: 'guest' | 'brand';
  name: string;
  profileId: string | null;
}

/** What an ingredient (or glass, or ice) is, for grouping and default owners. */
export interface ItemFacts {
  makerProfileId: string | null;
  role: string | null;
  abv: number | null;
  /** Its style's name ("Gin"). */
  kind: string | null;
  genericId: string | null;
}

export interface RunSheetInput {
  hostName: string;
  drinks: RunDrink[];
  swaps: RunSwap[];
  parties: RunParty[];
  /** Owners someone picked: item id to party id, or null for the host. Anything else takes the default. */
  owners: Record<string, string | null>;
  houseMade: Record<string, HouseMade>;
  purchasing: Record<string, Purchasing>;
  items: Record<string, ItemFacts>;
  /** List what house preps are made from, as well as the preps. */
  breakDownPreps: boolean;
}

export interface SheetLine extends SpecLine {
  /** "60 ml", "1". */
  per: string;
  /** "7.2 L" for all the serves; null without an amount. */
  total: string | null;
  garnish: boolean;
  /** What the library pours here, when this menu swapped it. */
  was: { id: string; name: string } | null;
}

export interface SheetDrink {
  id: string;
  itemId: string;
  name: string;
  serves: number;
  lines: SheetLine[];
  /** "Rocks glass · Large cube · Candied ginger". */
  serve: string;
}

export interface Need {
  key: string;
  /** The item an owner is stored against; null for ice nobody named. */
  itemId: string | null;
  name: string;
  group: GroupKey;
  /** "13.2 L", "200", "about 150 kg". */
  amount: string;
  /** "19 × 700 ml", "about 110 lemons", "keeps 14 days", "Penicillin, Negroni". */
  detail: string | null;
  /** The party that brings it; null is the hosting venue. */
  ownerId: string | null;
  /** Someone chose the owner (else it's the default). */
  picked: boolean;
  forDrinks: string[];
}

export interface PartySheet {
  id: string | null;
  name: string;
  role: 'Hosting' | 'Guest venue' | 'Brand';
  needs: Need[];
}

export interface RunSheet {
  totalServes: number;
  drinks: SheetDrink[];
  groups: { key: GroupKey; title: string; needs: Need[] }[];
  parties: PartySheet[];
}

const EPOCH = new Date(0);
// Juice from one fruit, roughly: enough to say "about 110 lemons".
const FRUIT: [RegExp, number, string][] = [
  [/\blemon juice\b/i, 40, 'lemons'],
  [/\blime juice\b/i, 30, 'limes'],
  [/\bgrapefruit juice\b/i, 150, 'grapefruit'],
  [/\borange juice\b/i, 80, 'oranges'],
];
// Ice that comes one piece a serve, so it counts when nobody has weighed it.
const ONE_PIECE = /\b(large|king|block|sphere|ball|spear|rock|big)\b/i;

/** The drink's lines with this menu's swaps in, each knowing what it replaced. */
export function swappedRecipe(drink: Pick<RunDrink, 'id' | 'recipe'>, swaps: RunSwap[]): (SpecLine & { was: { id: string; name: string } | null })[] {
  return drink.recipe.map((line) => {
    const swap = swaps.find((s) => s.menuDrinkId === drink.id && s.fromItemId === line.ingredientId);
    return swap ? { ...line, ingredientId: swap.toItemId, name: swap.toName, was: { id: line.ingredientId, name: line.name } } : { ...line, was: null };
  });
}

const isGarnishLine = (line: Pick<SpecLine, 'amount' | 'unit'>) => {
  const q = toQuantity(line.amount, line.unit);
  return !!q && q.kind === 'count' && isGarnishUnit(q.unit);
};

function perServe(line: SpecLine): string {
  if (line.amount == null || line.amount === '') return '';
  const unit = (line.unit ?? '').trim();
  return unit && unit.toLowerCase() !== 'each' ? `${line.amount} ${unit}` : String(line.amount);
}

function amountOf(quantities: Quantity[]): string {
  const parts = quantities
    .filter((q) => q.value > 0)
    .map((q) => (q.kind === 'count' && q.unit === 'each' ? String(Math.round(q.value * 10) / 10) : formatQuantity(q)));
  return parts.join(' + ') || 'Amount not set';
}

function fruitFor(name: string, quantities: Quantity[]): string | null {
  const ml = quantities.find((q) => q.kind === 'ml')?.value;
  const fruit = ml ? FRUIT.find(([re]) => re.test(name)) : undefined;
  if (!fruit || !ml) return null;
  const n = ml / fruit[1];
  return `about ${n >= 50 ? Math.round(n / 10) * 10 : Math.ceil(n)} ${fruit[2]}`;
}

function groupFor(id: string, name: string, quantities: Quantity[], input: RunSheetInput): GroupKey {
  if (quantities.length && quantities.every((q) => q.kind === 'count' && isGarnishUnit(q.unit))) return 'garnish';
  if (input.houseMade[id]) return 'preps';
  const f = input.items[id];
  const section = barSection({ name, kind: f?.kind, role: f?.role, abv: f?.abv });
  if (section === 'preps') return 'preps';
  if (section === 'bottles') return 'spirits';
  return isMixer(name) ? 'mixers' : 'fresh';
}

/** A run sheet for the menu, as the boards draw it. */
export function buildRunSheet(input: RunSheetInput): RunSheet {
  const counted = input.drinks.filter((d) => (d.serves ?? 0) > 0);
  const swapped = new Map(input.drinks.map((d) => [d.id, swappedRecipe(d, input.swaps)]));
  const guest = input.parties.find((p) => p.kind === 'guest') ?? null;
  const guestDrinks = new Set(input.drinks.filter((d) => d.byGuest).map((d) => d.name));
  const partyIds = new Set(input.parties.map((p) => p.id));

  const drinks: SheetDrink[] = input.drinks.map((d) => {
    const serves = d.serves ?? 0;
    const lines = swapped.get(d.id)!.map((line) => {
      const q = toQuantity(line.amount, line.unit);
      return { ...line, per: perServe(line), total: q && serves ? amountOf([scale(q, serves)]) : null, garnish: isGarnishLine(line) };
    });
    const garnishes = lines.filter((l) => l.garnish).map((l) => l.name);
    return { id: d.id, itemId: d.itemId, name: d.name, serves, lines, serve: [d.glass?.name, d.ice?.name, ...garnishes].filter(Boolean).join(' · ') };
  });

  const prep = buildPrepList({
    drinks: counted.filter((d) => d.itemType === 'cocktail').map((d) => ({ id: d.id, name: d.name, recipe: swapped.get(d.id)!, serves: d.serves })),
    servesPerDrink: 0,
    houseMade: input.breakDownPreps ? input.houseMade : {},
    purchasing: input.purchasing,
    startsAt: EPOCH,
    now: EPOCH,
  });

  // The drinks a thing ends up in, through any house preps it goes into.
  const madeFor = new Map(prep.make.map((m) => [m.name, m.forDrinks]));
  const drinksOf = (names: string[], depth = 0): string[] =>
    depth > 4 ? names : [...new Set(names.flatMap((n) => (madeFor.has(n) ? drinksOf(madeFor.get(n)!, depth + 1) : [n])))];

  const ownerOf = (itemId: string | null, made: boolean, forDrinks: string[]): { ownerId: string | null; picked: boolean } => {
    if (itemId && itemId in input.owners) {
      const picked = input.owners[itemId];
      return { ownerId: picked && partyIds.has(picked) ? picked : null, picked: true };
    }
    const maker = itemId ? input.items[itemId]?.makerProfileId : null;
    const brand = maker ? input.parties.find((p) => p.kind === 'brand' && p.profileId === maker) : undefined;
    if (brand) return { ownerId: brand.id, picked: false };
    const theirs = forDrinks.length > 0 && forDrinks.every((n) => guestDrinks.has(n));
    return { ownerId: guest && made && theirs ? guest.id : null, picked: false };
  };

  const needs: Need[] = [];
  const things = [
    ...prep.make.map((m) => ({ id: m.id, name: m.name, quantities: m.quantities, forDrinks: m.forDrinks, packs: m.batches })),
    ...prep.order.flatMap((o) => o.lines).map((l) => ({ id: l.id, name: l.name, quantities: l.quantities, forDrinks: l.forDrinks, packs: l.packs })),
  ];
  for (const t of things) {
    const group = groupFor(t.id, t.name, t.quantities, input);
    const viaPrep = t.forDrinks.length > 0 && t.forDrinks.every((n) => madeFor.has(n));
    const forDrinks = drinksOf(t.forDrinks);
    const keeps = input.houseMade[t.id] ? keepsFor(input.houseMade[t.id].shelfLifeHours) : null;
    const detail = [t.packs, fruitFor(t.name, t.quantities), keeps].filter(Boolean).join(' · ') || null;
    needs.push({ key: t.id, itemId: t.id, name: t.name, group, amount: amountOf(t.quantities), detail, forDrinks, ...ownerOf(t.id, !!input.houseMade[t.id] || viaPrep, forDrinks) });
  }

  // Beer and wine on the menu: one of each a serve.
  for (const d of counted.filter((x) => x.itemType !== 'cocktail')) {
    needs.push({ key: d.itemId, itemId: d.itemId, name: d.name, group: 'beerWine', amount: String(d.serves), detail: null, forDrinks: [d.name], ...ownerOf(d.itemId, false, [d.name]) });
  }

  // A glass a serve.
  const glasses = new Map<string, { name: string; n: number; drinks: string[] }>();
  for (const d of counted) {
    if (!d.glass) continue;
    const g = glasses.get(d.glass.id) ?? { name: d.glass.name, n: 0, drinks: [] };
    g.n += d.serves!;
    g.drinks.push(d.name);
    glasses.set(d.glass.id, g);
  }
  for (const [id, g] of glasses) needs.push({ key: id, itemId: id, name: g.name, group: 'glassware', amount: String(g.n), detail: g.drinks.join(', '), forDrinks: g.drinks, ...ownerOf(id, false, g.drinks) });

  // Ice by weight where it's weighed; one piece a serve for big ice nobody weighed.
  const iceId = new Map(counted.filter((d) => d.ice).map((d) => [d.ice!.name, d.ice!.id]));
  for (const ice of iceForEvent(counted.map((d) => ({ name: d.name, iceType: d.ice?.name ?? null, icePerServeG: d.icePerServeG, serves: d.serves })), 0)) {
    const id = iceId.get(ice.type) ?? null;
    needs.push({ key: id ?? `ice:${ice.type}`, itemId: id, name: ice.type, group: 'ice', amount: `about ${formatIce(ice.grams)}`, detail: null, forDrinks: ice.forDrinks, ...ownerOf(id, false, ice.forDrinks) });
  }
  const unweighed = new Map<string, { name: string; n: number; drinks: string[] }>();
  for (const d of counted) {
    if (!d.ice || (d.icePerServeG ?? 0) > 0 || /^(none|no ice|neat|up)$/i.test(d.ice.name)) continue;
    const u = unweighed.get(d.ice.id) ?? { name: d.ice.name, n: 0, drinks: [] };
    u.n += d.serves!;
    u.drinks.push(d.name);
    unweighed.set(d.ice.id, u);
  }
  for (const [id, u] of unweighed) {
    if (needs.some((n) => n.key === id)) continue;
    const pieces = ONE_PIECE.test(u.name);
    needs.push({ key: id, itemId: id, name: u.name, group: 'ice', amount: pieces ? String(u.n) : `for ${u.n} serves`, detail: pieces ? null : 'Weight per serve not set', forDrinks: u.drinks, ...ownerOf(id, false, u.drinks) });
  }

  const byName = (a: Need, b: Need) => a.name.localeCompare(b.name);
  const groups = GROUPS.map((g) => ({ ...g, needs: needs.filter((n) => n.group === g.key).sort(byName) })).filter((g) => g.needs.length);
  const ordered = groups.flatMap((g) => g.needs);
  const parties: PartySheet[] = [
    { id: null, name: input.hostName, role: 'Hosting', needs: ordered.filter((n) => n.ownerId === null) },
    ...[...input.parties]
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'guest' ? -1 : 1))
      .map((p): PartySheet => ({ id: p.id, name: p.name, role: p.kind === 'guest' ? 'Guest venue' : 'Brand', needs: ordered.filter((n) => n.ownerId === p.id) })),
  ];

  return { totalServes: input.drinks.reduce((sum, d) => sum + (d.serves ?? 0), 0), drinks, groups, parties };
}

export interface BrandBottle {
  id: string;
  name: string;
  genericId: string | null;
  /** The style's name, "Gin". */
  kindName: string | null;
  partyId: string;
}

export interface PourSuggestion {
  bottle: BrandBottle;
  /** The swaps to save: one per line that pours this kind of bottle. */
  swaps: { menuDrinkId: string; fromItemId: string }[];
  drinkCount: number;
}

/** "Pour Mill & Ash Gin everywhere?": a brand's bottle whose kind the menu pours in another bottle. */
export function pourSuggestions(drinks: RunDrink[], swaps: RunSwap[], items: Record<string, ItemFacts>, bottles: BrandBottle[]): PourSuggestion[] {
  const out: PourSuggestion[] = [];
  for (const bottle of bottles) {
    if (!bottle.genericId) continue;
    const hits: { menuDrinkId: string; fromItemId: string }[] = [];
    for (const d of drinks) {
      for (const line of swappedRecipe(d, swaps)) {
        const current = { ingredientId: line.ingredientId, genericId: items[line.ingredientId]?.genericId ?? null };
        if (lineHits(current, bottle.genericId, bottle.id, 'kind')) hits.push({ menuDrinkId: d.id, fromItemId: line.was?.id ?? line.ingredientId });
      }
    }
    if (hits.length) out.push({ bottle, swaps: hits, drinkCount: new Set(hits.map((h) => h.menuDrinkId)).size });
  }
  return out.sort((a, b) => b.drinkCount - a.drinkCount);
}
