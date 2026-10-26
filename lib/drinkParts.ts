/**
 * A drink made in parts (QA Q20b; supabase/migrations/20261122100000_drink_parts.sql):
 * a Pelican or an Irish Coffee is a drink, then a cream whipped and floated
 * on it. Each part has a name, the spec lines it uses, its own methods and,
 * after the first, how it joins (Float on top, Pour in). Stored as
 * items.parts (names and joins), recipes.part and item_methods.part.
 */
import { samePick, type WizardDraft, type WizardPick } from './drinkWizard';

export type PartJoin = 'float' | 'pour';
export const PART_JOINS: readonly { value: PartJoin; label: string }[] = [
  { value: 'float', label: 'Float on top' },
  { value: 'pour', label: 'Pour in' },
];
export const MAX_PARTS = 9;

/** A part while drafting: its lines by the wizard's line keys. */
export interface DraftPart {
  name: string;
  join?: PartJoin | null;
  lines: string[];
  methods: WizardPick[];
}

/** A part as items.parts keeps it. A type, not an interface, so it passes as Json. */
export type StoredPart = { name: string; join?: PartJoin };

/** Made in parts turned on: the drink so far is part 1, and part 2 floats on it. */
export function startParts(d: Pick<WizardDraft, 'lines' | 'methods'>): DraftPart[] {
  return [
    { name: '', lines: d.lines.map((l) => l.key), methods: d.methods },
    { name: '', join: 'float', lines: [], methods: [] },
  ];
}

/** Another part, floated on the one before. */
export const addPart = (parts: DraftPart[]): DraftPart[] => (parts.length >= MAX_PARTS ? parts : [...parts, { name: '', join: 'float', lines: [], methods: [] }]);

/** A line tapped in a part: it moves there from any other part, or out of it when it's there. */
export function toggleLine(parts: DraftPart[], at: number, key: string): DraftPart[] {
  const had = parts[at].lines.includes(key);
  return parts.map((p, i) => ({ ...p, lines: i === at ? (had ? p.lines.filter((k) => k !== key) : [...p.lines, key]) : p.lines.filter((k) => k !== key) }));
}

/** The drink's methods for everything that reads one list (the ice label, search, the kit check): each part's in order, each once. */
export function partsMethods(parts: readonly DraftPart[]): WizardPick[] {
  const out: WizardPick[] = [];
  for (const p of parts) for (const m of p.methods) if (!out.some((o) => samePick(o, m))) out.push(m);
  return out;
}

/** Which part a spec line is in: its part's, else the first for an ingredient and the last for a garnish (it finishes the drink). */
export function linePart(parts: readonly DraftPart[] | null | undefined, key: string, garnish: boolean): number {
  if (!parts?.length) return 1;
  const at = parts.findIndex((p) => p.lines.includes(key));
  return at >= 0 ? at + 1 : garnish ? parts.length : 1;
}

/** items.parts: a blank name becomes "Part 2", and the first part has no join. */
export const storedParts = (parts: readonly DraftPart[]): StoredPart[] =>
  parts.map((p, i) => ({ name: p.name.trim() || `Part ${i + 1}`, ...(i > 0 && p.join ? { join: p.join } : {}) }));

/** items.parts as read back, or null when it isn't a list of named parts. */
export function readParts(json: unknown): StoredPart[] | null {
  if (!Array.isArray(json) || json.length < 2) return null;
  return json.every((p) => p && typeof p === 'object' && typeof (p as StoredPart).name === 'string') ? (json as StoredPart[]) : null;
}

// How a method reads in a sentence; the rest read as their names.
const SAID: Record<string, string> = {
  build: 'Build in the glass',
  'whip (whisk or frother)': 'Whip with a whisk or frother',
  'whip (isi)': 'Whip in a siphon',
};

/** The drink page's line for a part: "Build in the glass: Irish whiskey, Hot coffee." "Whip with a whisk or frother: Cream, then float it on top." */
export function partSentence(methods: readonly string[], lines: readonly string[], join: PartJoin | null | undefined): string {
  const how = methods.map((m, i) => {
    const said = SAID[m.trim().toLowerCase()] ?? m.trim();
    return i ? said.charAt(0).toLowerCase() + said.slice(1) : said;
  });
  const what = how.length ? how.join(', then ') : 'Add';
  const then = join === 'float' ? ', then float it on top' : join === 'pour' ? ', then pour it in' : '';
  return `${what}${lines.length ? `: ${lines.join(', ')}` : ''}${then}.`;
}
