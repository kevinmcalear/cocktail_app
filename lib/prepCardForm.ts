/**
 * A house prep's card as the in-place editor holds it (ingredient-edit-proposal):
 * what a batch makes, how long it keeps, where it's stored, how long it takes,
 * how it's made and its steps, all as typed. Saved with the page's Done.
 */
export interface PrepFields {
  yieldAmount: string;
  yieldUnit: string;
  keeps: string;
  keepsUnit: KeepsUnit;
  storage: string;
  /** Minutes, as typed. */
  takes: string;
  takesNote: string;
  actions: string[];
  /** `tools`: the equipment ids or a venue's own tool names the step needs (item_steps.equipment). */
  steps: { key: string; body: string; timer: string; tools: string[] }[];
}

interface Card {
  prep: {
    yield_amount: number | null;
    yield_unit: string | null;
    shelf_life_hours: number | null;
    lead_time_minutes: number | null;
    lead_time_note: string | null;
    storage: string | null;
    actions: string[];
  } | null;
  steps: { body: string; timer_seconds: number | null; equipment?: string[] }[];
}

export const YIELD_UNITS = ['ml', 'L', 'g', 'kg'] as const;
export const KEEPS_UNITS = [
  { value: 'hours', hours: 1 },
  { value: 'days', hours: 24 },
  { value: 'weeks', hours: 24 * 7 },
  { value: 'months', hours: 24 * 30 },
] as const;
export type KeepsUnit = (typeof KEEPS_UNITS)[number]['value'];
export const STORAGE_PICKS = ['Fridge', 'Freezer', 'Shelf'] as const;

let nextKey = 0;
export const newStepField = (body = '', timer = '', tools: string[] = []) => ({ key: `s${nextKey++}`, body, timer, tools });

/** What a venue's ice makes: pieces, or a weight (crushed, shaved). */
export const ICE_YIELD_UNITS = ['pieces', 'kg'] as const;

/** The card as the editor starts it: the largest whole unit for how long it keeps. `units` are what Makes offers (ice: ICE_YIELD_UNITS). */
export function prepFields(card: Card | null | undefined, units: readonly string[] = YIELD_UNITS): PrepFields {
  const p = card?.prep ?? null;
  const hours = p?.shelf_life_hours ?? null;
  const unit = [...KEEPS_UNITS].reverse().find((u) => !!hours && hours % u.hours === 0) ?? KEEPS_UNITS[1];
  return {
    yieldAmount: p?.yield_amount ? String(p.yield_amount) : '',
    yieldUnit: p?.yield_unit && units.includes(p.yield_unit) ? p.yield_unit : units[0],
    keeps: hours ? String(hours / unit.hours) : '',
    keepsUnit: unit.value,
    storage: p?.storage ?? '',
    takes: p?.lead_time_minutes ? String(p.lead_time_minutes) : '',
    takesNote: p?.lead_time_note ?? '',
    actions: p?.actions ?? [],
    // Keys are left out of the compare (prepCardInput), so a fresh key never makes the page dirty.
    steps: (card?.steps ?? []).map((s) => newStepField(s.body, s.timer_seconds ? String(Math.round(s.timer_seconds / 60)) : '', s.equipment ?? [])),
  };
}

const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : null);

/** What savePrepCard writes, or why it can't yet. */
export function prepCardInput(f: PrepFields) {
  const yieldN = num(f.yieldAmount);
  const keepsN = num(f.keeps);
  const takesN = num(f.takes);
  const problem =
    yieldN !== null && !(yieldN > 0)
      ? 'What a batch makes should be more than 0.'
      : keepsN !== null && !(keepsN > 0)
        ? 'How long it keeps should be more than 0.'
        : takesN !== null && (takesN < 0 || !Number.isInteger(takesN))
          ? 'How long it takes is whole minutes.'
          : null;
  const hours = KEEPS_UNITS.find((u) => u.value === f.keepsUnit)?.hours ?? 24;
  return {
    problem,
    input: {
      prep: {
        yield_amount: yieldN,
        yield_unit: yieldN ? f.yieldUnit : null,
        shelf_life_hours: keepsN ? Math.round(keepsN * hours) : null,
        lead_time_minutes: takesN,
        lead_time_note: f.takesNote.trim() || null,
        storage: f.storage.trim() || null,
        actions: f.actions,
      },
      steps: f.steps.filter((s) => s.body.trim()).map((s) => ({ body: s.body.trim(), timer_seconds: s.timer.trim() ? Number(s.timer) * 60 : null, equipment: s.tools })),
    },
  };
}

/** Whether the card changed: what would be written, not the keys or untrimmed spaces. */
export const samePrepCard = (a: PrepFields, b: PrepFields) => JSON.stringify(prepCardInput(a).input) === JSON.stringify(prepCardInput(b).input);
