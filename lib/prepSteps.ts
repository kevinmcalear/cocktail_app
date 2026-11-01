/**
 * A house-made's recipe in Steps (boards Item-page, Desk-page, And-page:
 * "1 Juice · the day you make it", its lines, then the step's words). Pure;
 * components/screens/ingredient/HouseMadeRecipe draws it.
 *
 * A prep's steps are written as sentences (item_steps.body) and its lines
 * aren't tied to a step, so each step is read from its own words: its first
 * word is its name ("Warm the honey…" is Warm), its timer is the aside, the
 * sentence is the note under its lines, and a line sits in the first step
 * that names it. Lines no step names lead, before step 1.
 * ponytail: read from the words, so a step that opens "In a pan, warm…" is
 * named In. Upgrade path: name and aside columns on item_steps, typed in the
 * editor, if bars want their own (save_prep_spec would change: Kevin's).
 */
import { mentionAt } from './makeSteps';
import { timerLabel } from './scale';

export interface PrepStepGroup<L> {
  key: string;
  /** "1", "2"; null for the lines no step names. */
  number: string | null;
  /** The step's name: "Warm". */
  title: string | null;
  /** Beside the name, muted: its timer ("10 min"). */
  aside: string | null;
  /** Under its lines: the step as written. */
  note: string | null;
  lines: L[];
}

/** "Warm" from "Warm the honey…", "Make" from "Make a rich syrup: …". */
export function stepName(body: string): string | null {
  const word = /[\p{L}][\p{L}'-]*/u.exec(body.trim())?.[0];
  return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : null;
}

export function prepStepGroups<L extends { name: string }>(lines: readonly L[], steps: readonly { body: string; timer_seconds: number | null }[]): PrepStepGroup<L>[] {
  if (!steps.length) return lines.length ? [{ key: 'lines', number: null, title: null, aside: null, note: null, lines: [...lines] }] : [];
  const home = lines.map((l) => steps.findIndex((s) => mentionAt(s.body, l.name) >= 0));
  const lead = lines.filter((_, i) => home[i] < 0);
  return [
    ...(lead.length ? [{ key: 'lead', number: null, title: null, aside: null, note: null, lines: lead }] : []),
    ...steps.map((s, i) => ({
      key: `step-${i}`,
      number: String(i + 1),
      title: stepName(s.body),
      aside: s.timer_seconds ? timerLabel(s.timer_seconds) : null,
      note: s.body.trim() || null,
      // In the order the step names them.
      lines: lines.filter((_, j) => home[j] === i).sort((a, b) => mentionAt(s.body, a.name) - mentionAt(s.body, b.name)),
    })),
  ];
}
