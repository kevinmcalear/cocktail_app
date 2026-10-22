/**
 * A batch the way bars write one: lines of a drink dropped on each other
 * become one bottle. In the drink it's one line ("60 ml Ash Garden batch");
 * inside, the recipe for one bottle, split by the drink's own ratio. It's a
 * house prep of the kind 'batch' (lib/prepKinds), saved with the drink like
 * any other: its lines are in ml, their parts the ml each puts in one drink,
 * so the per-drink amounts and the split come back exact (perDrink).
 * Pure and plain JSON, for the wizard's stored draft. Board
 * eddie-oct22-wave2, fix 9.
 */
import { density, toMl } from './drinkMath';
import { amountOf, newLine, perDrink, POUR_ML, type WizardLine } from './drinkWizard';
import type { PrepDraft, PrepDraftLine } from './prepKinds';

export const BATCH_BOTTLE_ML = 750;

export const isBatch = (l: Pick<WizardLine, 'prep'>): boolean => l.prep?.kind === 'batch';

/** A line's pour in ml (an oz is the bar's 30; dashes, grams through the density); null for a top, a count or no amount. */
export function pourMl(l: Pick<WizardLine, 'name' | 'amount' | 'unit'>): number | null {
  const n = amountOf(l.amount);
  const ml = n === null || n <= 0 ? null : POUR_ML[l.unit] ? n * POUR_ML[l.unit] : toMl(n, l.unit, density(l.name, null));
  return ml && ml > 0 ? ml : null;
}

/** Why a line can't go in the bottle, or null when it can. */
export function cannotBatch(l: WizardLine): string | null {
  // A house prep made here keeps its own recipe: it goes in a batch once it's saved.
  if (!isBatch(l) && (l.prep || l.later || l.technique)) return `${l.name} is a new house prep. Save the drink first, then batch it.`;
  if (pourMl(l) !== null) return null;
  return l.unit === 'top' ? `${l.name} is a top, so it's added at the pass, not bottled.` : `${l.name} needs an amount to go in a batch.`;
}

/** What one line puts in the bottle, per drink: itself, or a batch's own lines. */
function pours(l: WizardLine): PrepDraftLine[] {
  const lines = isBatch(l) ? perDrink([l]) : [l];
  return lines.flatMap((p) => {
    const ml = pourMl(p);
    return ml === null ? [] : [{ key: p.key, id: p.id, name: p.name, parts: ml, unit: 'ml', amount: '', pourUnit: p.unit, ...(p.note ? { note: p.note } : null) }];
  });
}

/** How much one bottle holds, from the recipe. */
export function bottleMl(prep: PrepDraft): number {
  const base = prep.lines.find((l) => l.key === prep.baseKey)?.parts ?? 0;
  const total = prep.lines.reduce((sum, l) => sum + (l.parts ?? 0), 0);
  return base ? Math.round((prep.baseAmount * total) / base) : BATCH_BOTTLE_ML;
}

/** The same recipe for another size of bottle. */
export function withBottle(prep: PrepDraft, ml: number): PrepDraft {
  const base = prep.lines.find((l) => l.key === prep.baseKey)?.parts ?? 0;
  const total = prep.lines.reduce((sum, l) => sum + (l.parts ?? 0), 0);
  return { ...prep, baseAmount: total ? (ml * base) / total : 0 };
}

/** About how many drinks a bottle pours (12 from 750 ml at 60 ml). */
export function drinksPerBottle(prep: PrepDraft, line: WizardLine): number | null {
  const per = pourMl(line);
  return per ? Math.floor(bottleMl(prep) / per + 0.01) : null;
}

/** "Batch · mezcal, agave syrup". */
export function batchSummary(prep: PrepDraft): string {
  return `Batch · ${prep.lines.map((l) => l.name.toLowerCase()).join(', ')}`;
}

/**
 * Lines dropped on each other, as one batch line where the first sat: named
 * after the drink, its pour the sum of theirs (in the first's unit when it's
 * ml, cl or oz), its bottle the size it had (else 750 ml).
 */
export function batchOf(lines: readonly WizardLine[], drinkName: string, bottle?: number, taken: readonly string[] = []): WizardLine {
  const recipe = lines.flatMap(pours);
  const total = recipe.reduce((sum, l) => sum + (l.parts ?? 0), 0);
  const into = ['ml', 'cl', 'oz'].includes(lines[0].unit) ? lines[0].unit : 'ml';
  const prep: PrepDraft = { kind: 'batch', baseKey: recipe[0]?.key ?? '', baseAmount: 0, lines: recipe, steps: [], keepsHours: null, storage: '', leadMinutes: null, actions: [] };
  const was = lines.find(isBatch);
  // A second batch in the drink gets its own name: two of one name would save as one prep.
  const base = `${drinkName.trim() || 'House'} batch`;
  let name = was?.name ?? base;
  for (let n = 2; !was && taken.some((t) => t.toLowerCase() === name.toLowerCase()); n++) name = `${base} ${n}`;
  return {
    ...newLine({ id: null, name }, into, String(Math.round((total / POUR_ML[into]) * 100) / 100)),
    ...(was ? { key: was.key } : null),
    prep: withBottle(prep, bottle ?? (was?.prep ? bottleMl(was.prep) : BATCH_BOTTLE_ML)),
  };
}

/**
 * Drop `from` on `onto`: the drink's lines with the two as one batch, where
 * `onto` sat (or where the batch was, when one already is).
 */
export function dropInto(lines: readonly WizardLine[], from: string, onto: string, drinkName: string): WizardLine[] {
  const a = lines.find((l) => l.key === from);
  const b = lines.find((l) => l.key === onto);
  if (!a || !b || a === b) return [...lines];
  const stays = isBatch(a) && !isBatch(b) ? a : b;
  const batch = batchOf(stays === a ? [a, b] : [b, a], drinkName, undefined, lines.filter(isBatch).map((l) => l.name));
  return lines.flatMap((l) => (l === stays ? [batch] : l === a || l === b ? [] : [l]));
}

/** A batch back into its lines, each its share of the batch's pour. */
export function splitBatch(lines: readonly WizardLine[], key: string): WizardLine[] {
  return lines.flatMap((l) => (l.key === key ? perDrink([l]) : [l]));
}
