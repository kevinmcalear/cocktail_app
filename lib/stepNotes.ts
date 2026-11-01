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
/** The count shows from here (Miss-steps-cases, Near the limit). */
const NOTE_NEAR = 50;

/** "42 left" once a note nears NOTE_MAX; null before that. */
export function noteLeft(note: string): string | null {
  const left = NOTE_MAX - note.length;
  return left <= NOTE_NEAR ? `${left} left` : null;
}

export function stepDraft(rows: readonly StepNote[] | null | undefined): StepDraft {
  return Object.fromEntries((rows ?? []).map((r) => [r.step_key, { aside: r.aside ?? '', note: r.note ?? '' }]));
}

/** The steps of a drink while it's edited, by the same rule as the page. */
export function draftSteps(items: readonly SortableRecipeItem[], parts: readonly DraftPart[] | null, verb: string | null) {
  const lines = items.map((item, i) => ({
    // Trimmed as the page's lines are (lib/spec.ts), so both find the same garnish.
    unit: item.unit?.trim() || null,
    name: item.name,
    float: !!item.is_float,
    part: parts ? linePart(parts, toLine(item, i).key, false) : 1,
  }));
  return specGroups(lines, verb, parts?.map((p) => p.name));
}

const has = (w?: StepWords) => !!(w?.aside.trim() || w?.note.trim());

/**
 * Float lines moved into a part: the Float step is gone, so its words go to
 * the step the float lines are in now (the first step with one), never
 * dropped. Steps are keyed by kind (main, float, part-N), and a float key only
 * exists while the drink isn't in parts, so this is the one place words would
 * otherwise be lost on save.
 *
 * Where the target step has words already, the two are joined, the target's
 * first: asides with " · " (if that is over ASIDE_MAX the float's aside goes
 * to the front of the float's note instead), notes with a blank line (cut at
 * NOTE_MAX, the table's limit, only if both together are longer than that).
 * With no float lines left at all, the step is gone and so are its words.
 */
export function carryFloatWords(draft: StepDraft, steps: readonly { key: string; lines: readonly { float?: boolean }[] }[]): StepDraft {
  const from = draft.float;
  if (!has(from) || steps.some((s) => s.key === 'float')) return draft;
  const to = steps.find((s) => s.key !== 'garnish' && s.lines.some((l) => l.float));
  if (!to) return draft;
  return joinWords(draft, 'float', to.key);
}

/** One step's words joined after another's (the rule of carryFloatWords); the first key's words are removed. */
function joinWords(draft: StepDraft, fromKey: string, toKey: string): StepDraft {
  const { [fromKey]: from, ...rest } = draft;
  const there = rest[toKey] ?? { aside: '', note: '' };
  const [a1, a2] = [there.aside.trim(), from.aside.trim()];
  const joined = [a1, a2].filter(Boolean).join(' · ');
  const fits = joined.length <= ASIDE_MAX;
  const note = [there.note.trim(), fits ? '' : a2, from.note.trim()].filter(Boolean).join('\n\n');
  return { ...rest, [toKey]: { aside: fits ? joined : a1, note: note.slice(0, NOTE_MAX) } };
}

type Step = { key: string; lines: readonly { name: string }[] };

/**
 * Parts turned off: each part that is no longer a step hands its words to the
 * step its first line lands in (main, or float for a float line), joined by
 * the same rule. `before` and `after` are the drink's steps with and without
 * its parts. Part 1 keeps main's key, so its words stay. A part with no lines
 * loses its words, as an emptied step does.
 */
export function carryPartWords(draft: StepDraft, before: readonly Step[], after: readonly Step[]): StepDraft {
  const keys = new Set(after.map((s) => s.key));
  return before.reduce((acc, step) => {
    if (keys.has(step.key) || !has(acc[step.key])) return acc;
    const to = after.find((s) => s.key !== 'garnish' && s.lines.some((l) => l.name === step.lines[0]?.name));
    return to ? joinWords(acc, step.key, to.key) : acc;
  }, draft);
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
