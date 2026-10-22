/**
 * When the bar already has a drink with that name (board dup-drink-warning,
 * 22 Oct): how names are compared, and what adding one waits on. Unlike the
 * classic match (lib/classics.ts), words in brackets count, so "Negroni
 * (summer)" is a different name from "Negroni".
 */
import { convertPour, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';

/** What a new drink is to the bar's drink with the same name, once picked. Plain JSON: it's kept in the draft. */
export interface SameAs {
  /** The bar's drink. */
  id: string;
  name: string;
  /** Whose it is ("Little Rye"), as the screens say it. */
  bar: string;
  as: 'version' | 'different';
  /** A version's word in brackets ("summer"). */
  word?: string;
  /** Started from the bar's spec: what goes in it ("gin, Campari, sweet vermouth"). */
  started?: string | null;
}

/** A name with case, accents, spaces and punctuation set aside: "Vieux Carré (Ours)" and "vieux carre ours" are one name. */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const sameName = (a: string, b: string) => !!nameKey(a) && nameKey(a) === nameKey(b);

/**
 * An ILIKE pattern that every spelling of the name matches (and a few more,
 * which sameName then sets aside): its words in order, with the letters an
 * accent can sit on left open. Null for a name with no letters.
 */
export function nameLike(name: string): string | null {
  const key = nameKey(name);
  if (!key) return null;
  return `%${key.split(' ').map((w) => w.replace(/[aceinouy]/g, '_')).join('%')}%`;
}

/** "Negroni" and "summer" make "Negroni (summer)"; no word yet is the name alone. */
export const versionName = (name: string, word = '') => (word.trim() ? `${name.trim()} (${word.trim()})` : name.trim());

/** "Little Rye’s Negroni". */
export const theirs = (bar: string, name: string) => `${bar}’s ${name}`;

/**
 * Whether Next (or Save) waits on the name: the bar's drink shows and
 * nothing's picked for it, a version has no word yet, or a different drink
 * still has the same name.
 */
export function nameWaits(draft: Pick<WizardDraft, 'name' | 'sameAs'>, match: { id: string } | null | undefined): boolean {
  const same = draft.sameAs ?? null;
  if (match && same?.id !== match.id) return true;
  if (same?.as === 'version') return !same.word?.trim();
  return same?.as === 'different' && sameName(draft.name, same.name);
}

/** Whether the credits step waits: the bar it's credited to has a drink by this name and nothing's picked for it. */
export const creditWaits = (draft: Pick<WizardDraft, 'sameAs'>, match: { id: string } | null | undefined) => !!match && draft.sameAs?.id !== match.id;

/** Whether a step's Next waits on a pick (the name step and the credits step). */
export function stepWaits(step: WizardStep, draft: WizardDraft, atBar: { id: string } | null | undefined, atPlace: { id: string } | null | undefined): boolean {
  if (step === 'name') return nameWaits(draft, atBar);
  if (step === 'credits') return creditWaits(draft, atPlace);
  return false;
}

/** The name step's heading while it asks for a version's word; null keeps the usual one. */
export function versionHeading(draft: Pick<WizardDraft, 'sameAs'>): { eyebrow: string; title: string } | null {
  const same = draft.sameAs;
  if (same?.as !== 'version') return null;
  return { eyebrow: `Version of ${theirs(same.bar, same.name)}`, title: 'What’s different about this one?' };
}

// --- comparing a sheet's spec with the bar's ---

export interface SpecLine {
  /** The ingredient's id, when it's matched to one. */
  id: string | null;
  name: string;
  amount: string;
  unit: string;
}

export interface SpecDifference {
  name: string;
  /** "60 ml", or null when that side hasn't got the line. */
  sheet: string | null;
  bar: string | null;
}

const pour = (l: SpecLine) => `${l.amount} ${l.unit}`.trim() || 'some';

/**
 * Where a sheet's spec and the bar's differ, line by line: an amount or unit
 * that changed, or a line only one of them has. Lines are the same
 * ingredient by id, else by name. Empty is the same spec.
 */
export function specDifferences(sheet: readonly SpecLine[], bar: readonly SpecLine[]): SpecDifference[] {
  const key = (l: SpecLine) => l.id ?? nameKey(l.name);
  const theirs = new Map(bar.map((l) => [key(l), l]));
  const out: SpecDifference[] = [];
  for (const l of sheet) {
    const b = theirs.get(key(l)) ?? bar.find((x) => nameKey(x.name) === nameKey(l.name));
    if (b) theirs.delete(key(b));
    if (!b) out.push({ name: l.name, sheet: pour(l), bar: null });
    else if (pour(b) !== pour(l)) out.push({ name: l.name, sheet: pour(l), bar: pour(b) });
  }
  for (const b of theirs.values()) out.push({ name: b.name, sheet: null, bar: pour(b) });
  return out;
}

/** A stored spec line in the unit the sheet is shown in (amounts the way the wizard writes them). */
export function storedLine(l: { id: string | null; name: string; amount: number | null; unit: string | null }, usual: string): SpecLine {
  const unit = (l.unit ?? '').trim().toLowerCase();
  if (l.amount === null) return { id: l.id, name: l.name, amount: '', unit };
  const p = convertPour(l.amount, unit || usual, usual);
  return { id: l.id, name: l.name, amount: p.amount, unit: p.unit };
}

/**
 * Whether a Bring in drink's save waits: the bar has one by this name with a
 * different spec and nothing's picked for it (or Keep both has no word yet);
 * 'same' when it has the very spec, so there's nothing to save.
 */
export function sheetWaits(match: { id: string } | null | undefined, differences: readonly SpecDifference[], pick: { id: string; as: string; word?: string } | null | undefined): boolean | 'same' {
  if (!match) return false;
  if (!differences.length) return 'same';
  if (pick?.id !== match.id) return true;
  return pick.as === 'keep' && !pick.word?.trim();
}
