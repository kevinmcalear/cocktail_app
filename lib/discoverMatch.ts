/**
 * Why a drink is in Discover's search results, from discover_list's
 * match_kind and match_text (supabase/migrations/20261010620000_discover_match.sql):
 * its name, the classic it's a version of, an ingredient, its description or
 * its bar's name. Strong matches (name, classic) lead; the rest read as
 * "Also mentions". Also names the best match on its bar's map pin. Pure;
 * checked by lib/discoverMatch.check.ts.
 */
import { foldName } from './discover';
import type { MapPin } from './discoverMap';

export type MatchKind = 'name' | 'riff' | 'line' | 'description' | 'bar';

export interface DrinkMatch {
  kind: MatchKind;
  /** The classic's name for 'riff', the ingredient for 'line'. */
  text: string | null;
}

const KINDS: readonly string[] = ['name', 'riff', 'line', 'description', 'bar'];

/** A row's match columns as a DrinkMatch; null with no search (or from an older server). */
export function toMatch(kind: string | null | undefined, text: string | null | undefined): DrinkMatch | null {
  return kind && KINDS.includes(kind) ? { kind: kind as MatchKind, text: text ?? null } : null;
}

/** Matched by what it's called or what it's a version of: no "why" needed beyond the name. */
export function isStrong(match: DrinkMatch | null | undefined): boolean {
  return !match || match.kind === 'name' || match.kind === 'riff';
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** Roughly this many characters each side of the word in a description snippet. */
const AROUND = 28;

/** A short stretch of the description around the first searched word: "…a dirtier take on the classic martini, with…". */
export function snippet(description: string, search: string): string | null {
  const words = foldName(search).split(' ').filter(Boolean);
  const text = description.replace(/\s+/g, ' ').trim();
  const folded = foldName(text);
  // Folding can change the length (an accent's mark drops away); only cut when it didn't.
  if (folded.length !== text.length) return null;
  const at = words.map((w) => folded.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (at === undefined) return null;
  let start = Math.max(0, at - AROUND);
  let end = Math.min(text.length, at + AROUND + words[0].length);
  if (start > 0) start = text.indexOf(' ', start) + 1 || start;
  if (end < text.length) end = text.lastIndexOf(' ', end) > at ? text.lastIndexOf(' ', end) : end;
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Why a drink matched, in a few words, or null when its name says it.
 * "Riff on a Martini", "Has Martini Rosso", the description around the word,
 * "Matched the bar's name".
 */
export function matchWhy(match: DrinkMatch | null | undefined, description: string | null, search: string): string | null {
  if (!match) return null;
  switch (match.kind) {
    case 'name':
      return null;
    case 'riff':
      return match.text ? `Riff on ${article(match.text)} ${match.text}` : null;
    case 'line':
      return match.text ? `Has ${match.text}` : null;
    case 'description':
      return (description && snippet(description, search)) || 'In its description';
    case 'bar':
      return "Matched the bar's name";
  }
}

/** How long a drink's name gets on a pin before it's cut. */
const PIN_NAME = 18;

/** "Dirty Martini", "Dirty Martini +1", cut to fit a pin. */
export function pinName(top: string, drinks: number): string {
  const name = top.length > PIN_NAME ? `${top.slice(0, PIN_NAME - 1).trimEnd()}…` : top;
  return drinks > 1 ? `${name} +${drinks - 1}` : name;
}

/** How many bars' pins carry their best drink's name, besides the selected one. */
const NAMED = 3;

/**
 * While searching: the bars of the best few matches, and the selected bar,
 * show their best match's name on the pin instead of a count. `drinks` come
 * best first, so a bar's first drink is its best.
 */
export function namePins(pins: readonly MapPin[], drinks: readonly { barId: string; name: string }[], selectedId: string | null): MapPin[] {
  const best = new Map<string, string>();
  for (const d of drinks) if (!best.has(d.barId)) best.set(d.barId, d.name);
  const named = new Set([...best.keys()].slice(0, NAMED));
  if (selectedId) named.add(selectedId);
  return pins.map((p) => (named.has(p.id) && best.has(p.id) && !p.closed ? { ...p, top: best.get(p.id) } : p));
}

/** A bar's page, opened on what was searched (`?q=`), so its matches come first there. */
export function barSearchHref(ref: string, search: string): string {
  const q = search.trim();
  return q ? `/p/${ref}?q=${encodeURIComponent(q)}` : `/p/${ref}`;
}
