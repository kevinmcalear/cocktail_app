/**
 * A house prep whose recipe is written as a note in its description
 * ("Ingredients\n25 g Pine Needles\n500g Vodka\n…\nMethod\nBruise the pine…"),
 * read into lines and steps so it can scale, be made and count its allergens.
 * Pure; the prep page offers it (components/screens/ingredient/NoteRecipe).
 */
import { parseSpecLine, type SpecLine } from '@/lib/paste';

export interface NoteLine extends SpecLine {
  /** "30% by weight": what the note said that isn't an amount. */
  note?: string;
}

export interface NoteRecipe {
  /** Empty for a note that only has a method. */
  lines: NoteLine[];
  steps: string[];
  /** Something in the method doesn't match the list ("add Fernet Branca" when the list says Braulio). */
  check: { listed: string | null; method: string } | null;
}

const HEAD = /^\s*(ingredients?|method|steps?|directions?|instructions?)\s*:?\s*$/i;
/** What an import left in the note that isn't recipe: "No steps saved", "Makes 0g.", "By Will Bockman, 4th Dec 2024." */
const NOISE = /^(\d+[.)]\s*)?no steps saved\.?$|^makes\s+0\s*(g|ml)?\.?$|^by\s.+\d{4}\.?$/i;
const WORDS = (s: string) => s.toLowerCase().match(/[a-zà-ÿ]{3,}/g) ?? [];

/** The note read as a recipe, or null when it isn't one (neither two measured lines nor a method). */
export function readNoteRecipe(text: string | null | undefined): NoteRecipe | null {
  if (!text) return null;
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const lines: NoteLine[] = [];
  const method: string[] = [];
  // Under an "Ingredients" heading every row is a line, measured or not.
  let section: 'none' | 'ingredients' | 'method' = 'none';
  for (const raw of rows) {
    if (NOISE.test(raw)) continue;
    const head = raw.match(HEAD);
    if (head) {
      section = /^ingredients?$/i.test(head[1]) ? 'ingredients' : 'method';
      continue;
    }
    const row = raw.replace(/^[-•*]\s*/, '');
    const line = section === 'method' ? null : parseSpecLine(row) ?? (section === 'ingredients' ? unmeasured(row) : null);
    if (line) lines.push(line);
    else if (section !== 'ingredients' || lines.length) {
      section = 'method';
      method.push(raw);
    }
  }

  // One paragraph reads as its sentences; separate rows stay separate steps.
  const steps = (method.length === 1 ? method[0].split(/(?<=\.)\s+/) : method)
    .map((s) => s.replace(/\s+/g, ' ').replace(/^([-•*]|\d+[.)])\s*/, '').trim())
    .filter((s) => s.split(' ').length >= 2)
    .map((s) => (s[0].toUpperCase() + s.slice(1)).replace(/\s*,\s*$/, '.'));

  // Two measured lines, or a method of its own: anything less isn't a recipe.
  const measured = lines.filter((l) => l.amount !== null).length;
  if (measured < 2 && !(steps.length && (lines.length || method.length > 1))) return null;
  return { lines, steps, check: methodCheck(lines, steps.join(' ')) };
}

/** "Gospel Rye Whisky", "30% Coconut Oil, by Weight": a line with no amount, and what it says instead. */
function unmeasured(row: string): NoteLine | null {
  const pct = row.match(/^(\d+(?:\.\d+)?)\s*%\s*(.+?)(?:,\s*(by\s+\w+))?$/i);
  if (pct) return { amount: null, unit: null, name: pct[2].trim(), note: `${pct[1]}%${pct[3] ? ` ${pct[3].toLowerCase()}` : ''}` };
  const name = row.replace(/[.,;:]+$/, '').trim();
  return name && name.split(' ').length <= 6 ? { amount: null, unit: null, name } : null;
}

/**
 * A named product the method adds that the list doesn't have, paired with the
 * listed line the method never mentions (the likely mix-up). Names count when
 * they're capitalised after "add" ("add Fernet Branca"), so plain words
 * ("add sugar and a coffee filter") don't raise a question.
 */
function methodCheck(lines: NoteLine[], method: string): NoteRecipe['check'] {
  if (!lines.length) return null;
  const listedWords = new Set(lines.flatMap((l) => WORDS(l.name)));
  const named = [...method.matchAll(/\badd\s+((?:[A-Z][\p{L}'-]+)(?:\s+[A-Z][\p{L}'-]+)*)/gu)].map((m) => m[1]);
  const extra = named.find((n) => !WORDS(n).some((w) => listedWords.has(w)));
  if (!extra) return null;
  const said = new Set(WORDS(method));
  const unmentioned = lines.find((l) => !WORDS(l.name).some((w) => said.has(w) || said.has(w.replace(/s$/, ''))));
  return { listed: unmentioned?.name ?? null, method: extra };
}
