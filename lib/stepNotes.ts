/**
 * The words on a drink's steps (drink_step_notes): the aside beside a step's
 * heading and the note under its lines. Steps aren't rows: lib/specView.ts
 * specGroups works them out from the lines, and its key names the step here.
 */

import { linePart, type DraftPart } from '@/lib/drinkParts';
import { toLine, type SortableRecipeItem } from '@/lib/recipeItem';
import { specGroups } from '@/lib/specView';
import type { Row } from '@/types/db';

export type StepNote = Pick<Row<'drink_step_notes'>, 'step_key' | 'aside' | 'note'>;
export interface StepWords {
  aside: string;
  note: string;
}
/** The editor's words, by step key. */
export type StepDraft = Record<string, StepWords>;

export const ASIDE_MAX = 60;
export const NOTE_MAX = 500;

export function stepDraft(rows: readonly StepNote[] | null | undefined): StepDraft {
  return Object.fromEntries((rows ?? []).map((r) => [r.step_key, { aside: r.aside ?? '', note: r.note ?? '' }]));
}

/** The steps of a drink while it's edited, by the same rule as the page. */
export function draftSteps(items: readonly SortableRecipeItem[], parts: readonly DraftPart[] | null, verb: string | null) {
  const lines = items.map((item, i) => ({
    // Trimmed as the page's lines are (lib/spec.ts), so both find the same garnish.
    unit: item.unit?.trim() || null,
    float: !!item.is_float,
    part: parts ? linePart(parts, toLine(item, i).key, false) : 1,
  }));
  return specGroups(lines, verb);
}

/**
 * What saving the editor's words writes: a row for each of these steps with
 * words, and the keys to clear, which is every stored step that has none now
 * or is no longer a step of the drink. Null when nothing changed.
 */
export function stepNoteChanges(stored: readonly StepNote[], draft: StepDraft, keys: readonly string[]): { rows: StepNote[]; gone: string[] } | null {
  const rows = keys.flatMap((key) => {
    const aside = draft[key]?.aside.trim() || null;
    const note = draft[key]?.note.trim() || null;
    return aside || note ? [{ step_key: key, aside, note }] : [];
  });
  const kept = new Set(rows.map((r) => r.step_key));
  const gone = stored.filter((s) => !kept.has(s.step_key)).map((s) => s.step_key);
  const same = (r: StepNote) => stored.some((s) => s.step_key === r.step_key && s.aside === r.aside && s.note === r.note);
  return gone.length || !rows.every(same) ? { rows, gone } : null;
}

const partKey = (at: number) => (at ? `part-${at + 1}` : 'main');

/**
 * Parts moved or removed: each part's words go with it. `order` is the new
 * parts as positions in the old list. A removed part's words go too (Undo is
 * in the toolbar); the words of steps that aren't parts stay.
 */
export function moveStepDraft(draft: StepDraft, order: readonly number[], count: number): StepDraft {
  const old = new Set(Array.from({ length: count }, (_, at) => partKey(at)));
  const next = Object.fromEntries(Object.entries(draft).filter(([key]) => !old.has(key)));
  order.forEach((from, at) => {
    const words = draft[partKey(from)];
    if (words) next[partKey(at)] = words;
  });
  return next;
}
