/**
 * A house-made made in parts (board Add-parts): Penicillin batch uses
 * Honey-ginger syrup, which uses Fresh ginger juice. Each part is a line
 * with its own recipe (PrepDraftLine.prep), three levels at most, and they
 * all save together in one call (save_house_mades), all or none. Pure and
 * plain JSON.
 */
import { ingredientKey } from './ingredientNames';
import { prepAmounts, prepYield, type PrepDraft } from './prepKinds';
import { capitalizeFirst } from './stringUtils';

/** The house-made, a part of it, and a part of that: no "Make here" past this (Add-parts, 3). */
export const MOST_LEVELS = 3;

export interface HouseMadePart {
  name: string;
  prep: PrepDraft;
  /** 2 for a part of the house-made, 3 for a part of a part. */
  level: number;
}

/** Its parts, each before its own parts, in the order of the lines. */
export function partsOf(prep: PrepDraft | null, level = 2): HouseMadePart[] {
  if (!prep) return [];
  return prep.lines.flatMap((l) => (l.prep && l.name.trim() && !l.slot ? [{ name: capitalizeFirst(l.name.trim()), prep: l.prep, level }, ...partsOf(l.prep, level + 1)] : []));
}

/** A line of this recipe has its own part ("Has a part", Add-parts, 8). */
export const hasPart = (prep: PrepDraft | undefined) => !!prep?.lines.some((l) => l.prep);

/** "Penicillin batch, Honey-ginger syrup and Fresh ginger juice". */
export function namesList(names: string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Saving all of them (Add-parts, 8): "Saves 3 house-mades together: …. If one can't save, none do." Null without parts. */
export function savesTogether(name: string, prep: PrepDraft): string | null {
  const parts = partsOf(prep);
  if (!parts.length) return null;
  const names = [capitalizeFirst(name.trim()), ...parts.map((p) => p.name)];
  return `Saves ${names.length} house-mades together: ${namesList(names)}. If one can’t save, none do.`;
}

/** One line as save_house_mades takes it: a part (its index), an ingredient (its name too, in case it's gone since), or a name to find or add. */
export type PayloadLine = ({ part: number } | { id: string; name?: string } | { name: string; bottle?: boolean }) & { amount: number | null; unit: string | null; note: string | null };

export interface PayloadPrep {
  name: string;
  lines: PayloadLine[];
  card: { yield_amount: number | null; yield_unit: string | null; shelf_life_hours: number | null; lead_time_minutes: number | null; lead_time_note: null; storage: string | null; actions: string[] };
  steps: { body: string; timer_seconds: number | null }[];
  /** The line it's made from when that's a bottle (a fat wash of one). */
  base: number | null;
  made_from: string | null;
  /** Set by hand: declared and checked; otherwise null. */
  allergens: string[] | null;
}

/**
 * The house-made and its parts as save_house_mades takes them: itself first,
 * then each part, a part's line pointing at the part's index. A stand-in
 * nobody filled ("Spirit") and a blank line are never saved.
 */
export function houseMadePayload(name: string, prep: PrepDraft): PayloadPrep[] {
  const out: PayloadPrep[] = [];
  const add = (n: string, p: PrepDraft): number => {
    const at = out.length;
    const entry: PayloadPrep = {
      name: capitalizeFirst(n.trim()),
      lines: [],
      card: { yield_amount: prepYield(p), yield_unit: prepYield(p) ? 'ml' : null, shelf_life_hours: p.keepsHours, lead_time_minutes: p.leadMinutes, lead_time_note: null, storage: p.storage || null, actions: p.actions },
      steps: p.steps.map((s) => ({ body: s.body.trim(), timer_seconds: s.timer_seconds })),
      base: null,
      made_from: p.madeFrom?.id ?? null,
      allergens: p.allergensSet ? [...(p.allergens ?? [])] : null,
    };
    out.push(entry);
    for (const { line, amount } of prepAmounts(p)) {
      if (!line.name.trim() || line.slot) continue;
      const how = { amount, unit: line.unit || null, note: line.note?.trim() || null };
      if (line.key === p.baseKey) entry.base = entry.lines.length;
      // A part is added after the line that points at it is written, so its index is the next one.
      entry.lines.push(line.prep ? { part: add(line.name, line.prep), ...how } : line.id ? { id: line.id, name: line.name.trim(), ...how } : { name: capitalizeFirst(line.name.trim()), ...(line.bottle ? { bottle: true } : null), ...how });
    }
    return at;
  };
  add(name, prep);
  return out;
}

/**
 * Several house-mades, each with its parts, as one save_house_mades call
 * (board Add-inside: the drink's house-mades save with it, all or none):
 * their payloads one after another, each part's index moved along with it.
 * `at` is where each one starts, its id's place in what the call returns.
 * Two lines with one house-made (a pour and a finish) send it once, the
 * first line's recipe, and both use it: the call refuses a name twice.
 */
export function houseMadesPayload(made: readonly { name: string; prep: PrepDraft }[]): { payload: PayloadPrep[]; at: number[] } {
  const payload: PayloadPrep[] = [];
  const at: number[] = [];
  const sent = new Map<string, number>();
  for (const m of made) {
    const key = ingredientKey(m.name);
    const again = sent.get(key);
    if (again !== undefined) {
      at.push(again);
      continue;
    }
    const from = payload.length;
    sent.set(key, from);
    at.push(from);
    payload.push(...houseMadePayload(m.name, m.prep).map((p) => ({ ...p, lines: p.lines.map((l) => ('part' in l ? { ...l, part: l.part + from } : l)) })));
  }
  return { payload, at };
}
