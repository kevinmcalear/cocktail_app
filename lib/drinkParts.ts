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
  /** Made fresh for each serve, not ahead in the batch (items.parts "fresh"; a later part only). */
  fresh?: boolean;
}

/** A part as items.parts keeps it. A type, not an interface, so it passes as Json. `fresh`: made fresh for each serve, not ahead in a batch (20261126200000). */
export type StoredPart = { name: string; join?: PartJoin; fresh?: boolean };

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
  parts.map((p, i) => ({ name: p.name.trim() || `Part ${i + 1}`, ...(i > 0 && p.join ? { join: p.join } : {}), ...(i > 0 && p.fresh ? { fresh: true } : {}) }));

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

// --- editing a saved drink in parts (drink-edit-parts, approved 27 Oct 2026) ---

/** The methods' words for a part's button: "Build in the glass", "Whip with a whisk or frother". Empty for none. */
export const partMethodsSaid = (methods: readonly string[]): string => (methods.length ? partSentence(methods, [], null).slice(0, -1) : '');

/** The editor's lines in part order (each part's in the order they were), so the one list reads part by part. */
export function orderByPart<L extends { key?: string }>(parts: readonly DraftPart[] | null | undefined, lines: readonly L[]): L[] {
  if (!parts?.length) return [...lines];
  return lines
    .map((l, i) => ({ l, i, p: linePart(parts, l.key ?? '', false) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.l);
}

/**
 * The editor's spec in parts as one run, top to bottom: part 1's lines, then
 * each later part's heading and its lines. `line` is the line's index. A
 * heading slides aside like a line while one is held, so a line dropped past
 * it lands in that part. One part is just the lines.
 */
export type PartEntry = { line: number } | { part: number };

export function partEntries(parts: readonly DraftPart[] | null | undefined, keys: readonly string[]): PartEntry[] {
  if (!parts?.length) return keys.map((_, line) => ({ line }));
  return parts.flatMap((_, p) => [...(p ? [{ part: p + 1 }] : []), ...keys.flatMap((k, line) => (linePart(parts, k, false) === p + 1 ? [{ line }] : []))]);
}

/** The part a held entry lands in with its gap at `slot` among the others (lib/dropIndex dragSlot): the last heading above the gap's. */
export function slotPart(entries: readonly PartEntry[], from: number, slot: number): number {
  let part = 1;
  for (const e of entries.filter((_, i) => i !== from).slice(0, Math.max(0, slot))) if ('part' in e) part = e.part;
  return part;
}

/** Entry `from` (a line) put at `to` among the others: the lines' new order, as their indexes, and the part it lands in. */
export function dropEntry(entries: readonly PartEntry[], from: number, to: number): { order: number[]; part: number } {
  const rest = entries.filter((_, i) => i !== from);
  const at = Math.max(0, Math.min(to, rest.length));
  rest.splice(at, 0, entries[from]);
  return { order: rest.flatMap((e) => ('line' in e ? [e.line] : [])), part: slotPart(entries, from, at) };
}

/** A part moved one place up (-1) or down (1). The first part never joins; one that was first floats once it's later. */
export function movePart(parts: readonly DraftPart[], at: number, by: -1 | 1): DraftPart[] {
  const to = at + by;
  if (to < 0 || to >= parts.length) return [...parts];
  const next = [...parts];
  [next[at], next[to]] = [next[to], next[at]];
  return next.map((p, i) => ({ ...p, join: i ? (p.join ?? 'float') : null }));
}

/** A part removed: its lines go to the part before (the first part's to the next); its methods go with it. Under two parts left, the caller makes it one part. */
export function removePart(parts: readonly DraftPart[], at: number): DraftPart[] {
  const into = at ? at - 1 : 1;
  const gone = parts[at]?.lines ?? [];
  return parts
    .map((p, i) => (i === into ? { ...p, lines: at ? [...p.lines, ...gone] : [...gone, ...p.lines] } : p))
    .filter((_, i) => i !== at)
    .map((p, i) => (i ? p : { ...p, join: null }));
}

// --- Making it, part by part (board made-parts-making): the service view, the batch sheet, tick as I go ---

/** A part as the screens a drink is made from head it: its number, name, method names, how it's made in a phrase, and its join. */
export type MakingPart = { n: number; name: string; methods: string[]; how: string | null; join: PartJoin | null; fresh?: boolean };

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
    return { n: i + 1, name: p.name, methods: names, how: names.length ? partSentence(names, [], null).slice(0, -1) : null, join: i > 0 ? (p.join ?? null) : null, ...(i > 0 && p.fresh ? { fresh: true } : {}) };
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

// --- Made ahead or made fresh (batch, every part made ahead; approved 27 Oct 2026) ---

/** items.parts with part `n` made fresh for each serve, or ahead (the default, so the key goes). The first part is always the bottle. */
export function setPartFresh(parts: readonly StoredPart[], n: number, fresh: boolean): StoredPart[] {
  return parts.map((p, i) => {
    if (i !== n - 1 || i === 0) return p;
    const { fresh: _, ...rest } = p;
    return fresh ? { ...rest, fresh: true } : rest;
  });
}
