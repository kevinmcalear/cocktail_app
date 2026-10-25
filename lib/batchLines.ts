/**
 * A batch made in the add-drink wizard by dropping one line on another
 * (Eddie, 22 Oct): the drink keeps one line ("Ash Garden batch, 60 ml") and
 * the bottle's recipe is worked out from the drink's own amounts. The
 * per-drink lines stay inside the batch line, so costing, allergens, strength
 * and the drawing keep using them, and Split back into lines gets them back.
 * Saved as a house prep of the kind Batch (lib/prepKinds). Pure, plain JSON.
 */
import { convertPour, type WizardLine } from './drinkWizard';
import { withFacts, type PrepDraft } from './prepKinds';
import { tidyAmount } from './specDefaults';

/** The bottles the sheet offers, in ml; 750 is where it starts. */
export const BATCH_BOTTLES = [700, 750, 1000] as const;
export const DEFAULT_BOTTLE = 750;

/** A batch: the drink's own lines, as they were, and the bottle it fills. */
export interface LineBatch {
  lines: WizardLine[];
  bottleMl: number;
}

/** The units a pour is measured in, in ml; anything else (dashes, a barspoon, an egg) is counted per drink. */
const POUR_ML: Record<string, number> = { ml: 1, cl: 10, oz: 30 };
const POURS = new Set(Object.keys(POUR_ML));

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (s: string): number | null => {
  // A plain decimal as it is (tidyAmount keeps two places); fractions ("3/4") through tidyAmount.
  const n = /^\d+(\.\d+)?$/.test(s.trim()) ? parseFloat(s) : parseFloat(tidyAmount(s));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** One drink's pour of a line in ml (0.75 oz is 22.5), or null for a count, a top or no amount. */
export function pourMl(l: Pick<WizardLine, 'amount' | 'unit'>): number | null {
  const n = num(l.amount);
  // Not rounded: a share typed from the bottle (45.714 ml) has to fill it again.
  return n === null || !POURS.has(l.unit) ? null : n * POUR_ML[l.unit];
}

/** What one drink takes from the bottle, in ml: its pours added up. */
export function drinkMl(lines: readonly WizardLine[]): number {
  return round1(lines.reduce((s, l) => s + (pourMl(l) ?? 0), 0));
}

/** How many whole drinks a bottle makes ("about 12": 750 ml at 60 ml is 12 and a half). */
export function drinksPerBottle(bottleMl: number, perDrinkMl: number): number {
  return perDrinkMl > 0 ? Math.floor(bottleMl / perDrinkMl + 1e-9) : 0;
}

/**
 * Each line's amount in the bottle: pours scaled to fill it (45 and 15 ml in
 * a 750 ml bottle are 562.5 and 187.5), counts by the drinks it makes (2
 * dashes a drink, 25 dashes for 12 and a half drinks). Null with no amount.
 */
export function bottleAmounts(b: LineBatch): { line: WizardLine; amount: number | null; unit: string }[] {
  const per = drinkMl(b.lines);
  const scale = per > 0 ? b.bottleMl / per : 0;
  return b.lines.map((line) => {
    const ml = pourMl(line);
    if (ml !== null) return { line, amount: round1(ml * scale), unit: 'ml' };
    const n = num(line.amount);
    return { line, amount: n === null || !scale ? null : round1(n * scale), unit: line.unit };
  });
}

/** Units a bottle line that isn't a pour can be weighed or counted in (the batch sheet's unit chips). */
export const BOTTLE_UNITS = ['g', 'kg', 'tsp', 'tbsp', 'bsp', 'dash', 'drop', 'each', 'pinch'] as const;

const exact = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * A line's amount in the bottle, typed in the batch sheet (Kevin, 24 Oct:
 * 70 g of red miso in the Tempus Fugit). Every other amount in the bottle
 * stays as it is, the bottle is its pours added up, and one drink still
 * takes the same from it, so each line's share of one drink follows (70 g
 * over 33 and a third drinks is 2.1 g). Null is to taste. Pours keep their
 * unit. The batch as it was when that would leave nothing poured.
 */
export function withBottleAmount(b: LineBatch, key: string, amount: number | null, unit: string): LineBatch {
  const per = drinkMl(b.lines);
  const at = b.lines.find((l) => l.key === key);
  if (!at || per <= 0) return b;
  const typed = amount !== null && amount > 0 ? amount : null;
  // Each line as it is in the bottle now, and the typed one as typed: ml for a pour, else its own unit.
  const now = bottleAmounts(b);
  const inBottle = b.lines.map((l, i) => (l.key === key ? { amount: typed, unit } : now[i]));
  const poured = inBottle.map(({ amount: n, unit: u }) => (n !== null && POURS.has(u) ? n * POUR_ML[u] : null));
  const bottleMl = round1(poured.reduce<number>((s, ml) => s + (ml ?? 0), 0));
  if (bottleMl <= 0) return b;
  const drinks = bottleMl / per;
  return {
    bottleMl,
    lines: b.lines.map((l, i) => {
      const ml = poured[i];
      const { amount: n, unit: u } = inBottle[i];
      if (ml !== null) {
        const pour = POURS.has(l.unit) ? l.unit : 'ml';
        return { ...l, ...(pour === 'ml' ? { amount: exact(ml / drinks), unit: 'ml' } : convertPour(ml / drinks, 'ml', pour)) };
      }
      return { ...l, unit: u, amount: n === null ? '' : exact(n / drinks) };
    }),
  };
}

/** Lines that can go in a bottle: not a house prep still to make here (its recipe would be lost), nor a batch. */
export function canBatch(l: WizardLine): boolean {
  return !l.batch && !l.prep && !l.technique && !l.later;
}

/** The batch line's own amount: the pours one drink takes, in ounces when every pour was written in them. */
function lineAmount(lines: readonly WizardLine[]): { amount: string; unit: string } {
  const ml = drinkMl(lines);
  const poured = lines.filter((l) => pourMl(l) !== null);
  const oz = poured.length > 0 && poured.every((l) => l.unit === 'oz');
  return oz ? convertPour(ml, 'ml', 'oz') : { amount: String(ml), unit: 'ml' };
}

/** A batch line from these lines, keeping `key`; its name and bottle stay when it's a batch already. */
export function batchLine(key: string, name: string, lines: WizardLine[], bottleMl = DEFAULT_BOTTLE): WizardLine {
  return { key, id: null, name, ...lineAmount(lines), batch: { lines, bottleMl } };
}

/**
 * Drops `from` on `onto`. Two plain lines become one batch where `onto` was,
 * in the spec's order, named after the drink ("Ash Garden batch"). A line
 * dropped on a batch (or a batch on a line) goes in the bottle. Null when
 * they can't batch: two batches, a house prep still to make, or nothing
 * measured to fill a bottle with.
 */
export function mergeLines(lines: readonly WizardLine[], from: number, onto: number, drinkName: string): WizardLine[] | null {
  const a = lines[from];
  const b = lines[onto];
  if (!a || !b || from === onto || (a.batch && b.batch)) return null;
  const batch = b.batch ? b : a.batch ? a : null;
  const other = batch === b ? a : b;
  if (!canBatch(other) || (!batch && !canBatch(a))) return null;
  const inner = batch ? [...batch.batch!.lines, other] : from < onto ? [a, b] : [b, a];
  if (drinkMl(inner) <= 0) return null;
  const merged = batch ? batchLine(batch.key, batch.name, inner, batch.batch!.bottleMl) : batchLine(b.key, `${drinkName.trim() || 'House'} batch`, inner);
  return lines.flatMap((l, i) => (i === onto ? [merged] : i === from ? [] : [l]));
}

/** Split back into lines: the batch's own lines, where it was. */
export function splitBatch(lines: readonly WizardLine[], key: string): WizardLine[] {
  return lines.flatMap((l) => (l.key === key && l.batch ? l.batch.lines : [l]));
}

/** A batch with a new bottle or a line taken out: its amount follows. */
export function withBatch(line: WizardLine, batch: LineBatch): WizardLine {
  return { ...line, ...lineAmount(batch.lines), batch };
}

/** Every line as one drink pours it: a batch's own lines instead of the batch. For the drawing, the cost and the taste. */
export function perDrinkLines<L extends WizardLine>(lines: readonly L[]): WizardLine[] {
  return lines.flatMap((l) => (l.batch ? l.batch.lines : [l]));
}

/** "Batch · mezcal, agave syrup", under the batch line's name. */
export function batchCaption(b: LineBatch): string {
  return `Batch · ${b.lines.map((l) => l.name.toLowerCase()).join(', ')}`;
}

/**
 * The batch as a house prep of the kind Batch, for the drink's save: the
 * pours as parts of the bottle (their ml for one drink), the counts at the
 * bottle's amount, one step, and its yield the bottle.
 */
export function batchPrep(b: LineBatch): PrepDraft {
  const per = drinkMl(b.lines);
  const scaled = bottleAmounts(b);
  const lines = scaled.map(({ line, amount, unit }) => {
    const ml = pourMl(line);
    return { key: line.key, id: line.id, name: line.name, parts: ml, unit, amount: ml === null && amount !== null ? String(amount) : '', yieldPer: ml === null ? 0 : 1, ...(line.note ? { note: line.note } : null) };
  });
  const base = lines.find((l) => l.parts !== null) ?? lines[0];
  return withFacts({
    kind: 'batch',
    baseKey: base.key,
    baseAmount: base.parts && per > 0 ? (base.parts * b.bottleMl) / per : 0,
    lines,
    steps: [{ body: 'Measure everything into a clean bottle, close it and turn it over to mix. Label it with the name and the date.', timer_seconds: null }],
    keepsHours: null,
    storage: '',
    leadMinutes: null,
    actions: ['Batch'],
  });
}
