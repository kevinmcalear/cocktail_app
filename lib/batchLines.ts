/**
 * The drink's pours bottled ahead. In the add-drink wizard, dropping one line
 * on another combines them into a house prep (make-anything-overview, 24
 * Oct): one line ("Salty Boy batch, 22.5 ml") whose recipe starts as the
 * bottle the drink's own amounts fill, of the kind Batch, then opens in the
 * house prep steps like any other. A menu brought in from a file reads its
 * batch the same way (lib/bringInDraft, `batch` on the line). Pure, plain JSON.
 */
import { convertPour, type WizardLine } from './drinkWizard';
import { prepAmounts, prepYield, withFacts, type PrepDraft } from './prepKinds';
import { tidyAmount } from './specDefaults';

/** The bottle a batch starts as, in ml. */
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
const exact = (n: number) => String(Math.round(n * 1000) / 1000);
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

/** Lines that can be combined: not a house prep (its recipe would be lost), nor one still to write or a batch. */
export function canCombine(l: WizardLine): boolean {
  return !l.batch && !l.prep && !l.technique && !l.later;
}

/** The batch line's own amount: the pours one drink takes, in ounces when every pour was written in them. */
function lineAmount(lines: readonly WizardLine[]): { amount: string; unit: string } {
  const ml = drinkMl(lines);
  const poured = lines.filter((l) => pourMl(l) !== null);
  const oz = poured.length > 0 && poured.every((l) => l.unit === 'oz');
  return oz ? convertPour(ml, 'ml', 'oz') : { amount: String(ml), unit: 'ml' };
}

/** A batch line from these lines, keeping `key` (a menu brought in from a file). */
export function batchLine(key: string, name: string, lines: WizardLine[], bottleMl = DEFAULT_BOTTLE): WizardLine {
  return { key, id: null, name, ...lineAmount(lines), batch: { lines, bottleMl } };
}

/**
 * Drops `from` on `onto`: the two become one house prep line where `onto`
 * was, named after the drink ("Salty Boy batch"), its recipe the bottle
 * their pours fill (batchPrep), in the spec's order. The lines stay on it
 * (`combined`) until its recipe is done, so backing out puts them back. Null
 * when they can't: a house prep already, the same line, or nothing measured.
 */
export function combineLines(lines: readonly WizardLine[], from: number, onto: number, drinkName: string): WizardLine[] | null {
  const a = lines[from];
  const b = lines[onto];
  if (!a || !b || from === onto || !canCombine(a) || !canCombine(b)) return null;
  const inner = from < onto ? [a, b] : [b, a];
  if (drinkMl(inner) <= 0) return null;
  const merged: WizardLine = { key: b.key, id: null, name: `${drinkName.trim() || 'House'} batch`, ...lineAmount(inner), prep: batchPrep({ lines: inner, bottleMl: DEFAULT_BOTTLE }), combined: inner };
  return lines.flatMap((l, i) => (i === onto ? [merged] : i === from ? [] : [l]));
}

/** Backing out of a combine: the lines it was made from, where it was. */
export function uncombine(lines: readonly WizardLine[], key: string): WizardLine[] {
  return lines.flatMap((l) => (l.key === key && l.combined ? l.combined : [l]));
}

/** A line's house prep recipe: its own, or a batch's read from a file. */
export function linePrep(l: Pick<WizardLine, 'prep' | 'batch'>): PrepDraft | undefined {
  return l.prep ?? (l.batch ? batchPrep(l.batch) : undefined);
}

/**
 * Every line as one drink pours it: a batch's own lines instead of the
 * batch, each its share of the bottle (750 ml of mezcal and agave in a 60 ml
 * pour is 45 and 15). For the drawing, the cost and the taste. Any other
 * house prep stays one line, as a bottle would.
 */
export function perDrinkLines<L extends WizardLine>(lines: readonly L[]): WizardLine[] {
  return lines.flatMap((l): WizardLine[] => {
    if (l.batch) return l.batch.lines;
    const made = l.prep?.kind === 'batch' ? prepYield(l.prep) : null;
    const pour = pourMl(l);
    if (!l.prep || !made || pour === null) return [l];
    const share = pour / made;
    return prepAmounts(l.prep).map(({ line: p, amount }) => ({ key: p.key, id: p.id, name: p.name, unit: p.unit, amount: amount === null ? '' : exact(amount * share) }));
  });
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
