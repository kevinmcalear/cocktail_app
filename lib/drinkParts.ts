/**
 * A drink made in parts (QA Q20b; supabase/migrations/20261123100000_drink_parts.sql):
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

// --- Making it, part by part (board made-parts-making): the service view, the batch sheet, tick as I go ---

/** A part as the screens a drink is made from head it: its number, name, method names, how it's made in a phrase, and its join. */
export type MakingPart = { n: number; name: string; methods: string[]; how: string | null; join: PartJoin | null };

/** Which part a line or method is in, 1 to `count`: none is the first, and one past the last (never saved) is the last. */
export const partOf = (part: number | null | undefined, count: number): number => Math.min(Math.max(part ?? 1, 1), count);

/** The drink's parts with each one's methods ("Build in the glass"), or null for a drink in one part. */
export function makingParts(
  parts: readonly StoredPart[] | null | undefined,
  methods: readonly { part?: number | null; sort_order?: number | null; method?: { name?: string | null } | null }[] | null | undefined
): MakingPart[] | null {
  if (!parts || parts.length < 2) return null;
  const sorted = [...(methods ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return parts.map((p, i) => {
    const names = sorted.flatMap((m) => (partOf(m.part, parts.length) === i + 1 && m.method?.name ? [m.method.name] : []));
    // With no lines and no join, a part's sentence is just the phrase and its full stop.
    return { n: i + 1, name: p.name, methods: names, how: names.length ? partSentence(names, [], null).slice(0, -1) : null, join: i > 0 ? (p.join ?? null) : null };
  });
}

/** Lines in the part they're made in: one list per part, in order. */
export function byPart<T extends { part?: number | null }>(lines: readonly T[], count: number): T[][] {
  return Array.from({ length: count }, (_, i) => lines.filter((l) => partOf(l.part, count) === i + 1));
}

/** The join as the last step of its part: "Float it on top", "Pour it in". */
export function joinStep(join: PartJoin | null | undefined): string | null {
  return join === 'float' ? 'Float it on top' : join === 'pour' ? 'Pour it in' : null;
}
