/**
 * The prep list and order list, worked back from a menu: each drink's spec
 * scaled by expected serves, house-made ingredients turned into batches with
 * start-by times (and their own ingredients added to the order), and bought
 * ingredients rounded up to whole packs, grouped by supplier.
 * Pure: hooks/usePrepList.ts fetches the rows and hands them here.
 */

import { formatQuantity, sameKind, scale, toQuantity, type Quantity } from '@/lib/quantity';

export interface SpecLine {
  ingredientId: string;
  name: string;
  amount: number | string | null;
  unit: string | null;
}

export interface HouseMade {
  /** Recipe for one batch. */
  recipe: SpecLine[];
  yieldAmount: number | null;
  yieldUnit: string | null;
  leadTimeMinutes: number | null;
  leadTimeNote: string | null;
}

export interface Purchasing {
  supplierName: string | null;
  packAmount: number | null;
  packUnit: string | null;
}

export interface PrepInput {
  /** One serve of each drink on the menu. */
  drinks: { id: string; name: string; recipe: SpecLine[] }[];
  servesPerDrink: number;
  houseMade: Record<string, HouseMade>;
  purchasing: Record<string, Purchasing>;
  /** When service or the event starts; start-by times count back from it. */
  startsAt: Date;
  /** The current time, for marking what has to start within a day. */
  now: Date;
}

export interface MakeLine {
  id: string;
  name: string;
  needed: string;
  /** "3 batches of 1.5 L", when the yield is known. */
  batches: string | null;
  startBy: Date | null;
  /** Has to start within the next 24 hours. */
  urgent: boolean;
  /** Should already have started: start it now, and the batch may be late. */
  late: boolean;
  leadTimeNote: string | null;
  /** Drinks it goes into, for the row's subtitle. */
  forDrinks: string[];
}

export interface BuyLine {
  id: string;
  name: string;
  needed: string;
  /** "5 × 700 ml", when the pack size is known. */
  packs: string | null;
}

export interface PrepList {
  make: MakeLine[];
  order: { supplier: string; lines: BuyLine[] }[];
}

const NO_SUPPLIER = 'No supplier yet';
const MAX_DEPTH = 4;
const DAY_MS = 24 * 60 * 60_000;

interface Need {
  name: string;
  quantities: Quantity[];
  forDrinks: Set<string>;
}

function add(needs: Map<string, Need>, id: string, name: string, q: Quantity | null, drink: string) {
  const need = needs.get(id) ?? { name, quantities: [], forDrinks: new Set<string>() };
  need.forDrinks.add(drink);
  if (q) {
    const same = need.quantities.find((x) => sameKind(x, q));
    if (same) same.value += q.value;
    else need.quantities.push({ ...q });
  }
  needs.set(id, need);
}

export function buildPrepList(input: PrepInput): PrepList {
  const needs = new Map<string, Need>();
  for (const drink of input.drinks) {
    for (const line of drink.recipe) {
      const q = toQuantity(line.amount, line.unit);
      add(needs, line.ingredientId, line.name, q && scale(q, input.servesPerDrink), drink.name);
    }
  }

  // Expand house-made ingredients level by level: their batches add their own
  // ingredients to what's needed. Depth-limited, so a cycle can't loop forever.
  const make: MakeLine[] = [];
  const expanded = new Set<string>();
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const pending = [...needs.entries()].filter(([id]) => input.houseMade[id] && !expanded.has(id));
    if (!pending.length) break;
    for (const [id, need] of pending) {
      expanded.add(id);
      const hm = input.houseMade[id];
      const yieldQ = toQuantity(hm.yieldAmount, hm.yieldUnit);
      const neededQ = need.quantities.find((q) => yieldQ && sameKind(q, yieldQ)) ?? need.quantities[0] ?? null;
      const batchCount = yieldQ && neededQ && sameKind(yieldQ, neededQ) ? Math.ceil(neededQ.value / yieldQ.value) : null;
      const startBy = hm.leadTimeMinutes ? new Date(input.startsAt.getTime() - hm.leadTimeMinutes * 60_000) : null;
      make.push({
        id,
        name: need.name,
        needed: need.quantities.map(formatQuantity).join(' + ') || 'Amount not set',
        batches: batchCount && yieldQ ? `${batchCount} ${batchCount === 1 ? 'batch' : 'batches'} of ${formatQuantity(yieldQ)}` : null,
        startBy,
        urgent: !!startBy && startBy.getTime() < input.now.getTime() + DAY_MS,
        late: !!startBy && startBy.getTime() < input.now.getTime(),
        leadTimeNote: hm.leadTimeNote,
        forDrinks: [...need.forDrinks].sort(),
      });
      // Without a yield, one batch per spec amount is the only honest guess.
      const multiplier = batchCount ?? 1;
      for (const line of hm.recipe) {
        const q = toQuantity(line.amount, line.unit);
        add(needs, line.ingredientId, line.name, q && scale(q, multiplier), need.name);
      }
    }
  }

  const bySupplier = new Map<string, BuyLine[]>();
  for (const [id, need] of needs) {
    if (input.houseMade[id]) continue;
    const p = input.purchasing[id];
    const pack = p ? toQuantity(p.packAmount, p.packUnit) : null;
    const neededQ = need.quantities.find((q) => pack && sameKind(q, pack));
    const packs = pack && neededQ ? Math.ceil(neededQ.value / pack.value) : null;
    const line: BuyLine = {
      id,
      name: need.name,
      needed: need.quantities.map(formatQuantity).join(' + ') || 'Amount not set',
      packs: packs && pack ? `${packs} × ${formatQuantity(pack)}` : null,
    };
    const supplier = p?.supplierName ?? NO_SUPPLIER;
    bySupplier.set(supplier, [...(bySupplier.get(supplier) ?? []), line]);
  }

  make.sort((a, b) => (a.startBy?.getTime() ?? Infinity) - (b.startBy?.getTime() ?? Infinity) || a.name.localeCompare(b.name));
  const order = [...bySupplier.entries()]
    .sort(([a], [b]) => (a === NO_SUPPLIER ? 1 : b === NO_SUPPLIER ? -1 : a.localeCompare(b)))
    .map(([supplier, lines]) => ({ supplier, lines: lines.sort((a, b) => a.name.localeCompare(b.name)) }));
  return { make, order };
}

/**
 * Expected serves of each drink: guests × drinks per guest, spread evenly
 * across the menu. ponytail: even spread is a starting point the person
 * adjusts; real sales data would replace it.
 */
export function servesPerDrink(covers: number, drinkCount: number, drinksPerGuest = 2): number {
  if (drinkCount <= 0 || covers <= 0) return 0;
  return Math.max(1, Math.ceil((covers * drinksPerGuest) / drinkCount));
}
