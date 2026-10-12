/**
 * Why a drink is in Discover's search results, from discover_list's
 * match_kind and match_text (supabase/migrations/20261010625000_discover_match.sql):
 * its name, the classic it's a version of, an ingredient, its description or
 * its bar's name. Strong matches (name, classic) lead; the rest read as
 * "Also mentions". Also names the best match on its bar's map pin. Pure;
 * checked by lib/discoverMatch.check.ts.
 */
import { foldName } from './discover';
import type { MapPin } from './discoverMap';
import { STYLES } from './drinkStyles';

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
 * A name that has the searched style's word but isn't that style: "A coffee
 * cocktail, not the Martini style" for an Espresso Martini on "martini".
 * Null when the name is the style, or the search isn't one.
 */
export function notTheStyle(name: string, search: string): string | null {
  const q = foldName(search);
  const style = q ? STYLES.find((s) => s.name?.test(q)) : undefined;
  const folded = foldName(name);
  if (!style || style.name?.test(folded)) return null;
  const other = STYLES.find((s) => s !== style && s.name?.test(folded));
  const what = other ? other.label.replace(/s$/, '').toLowerCase() : null;
  return `${what ? `${article(what) === 'an' ? 'An' : 'A'} ${what}, not` : 'Not'} the ${style.classics[0]} style`;
}

/**
 * Why a drink matched, in a few words, or null when its name says it.
 * "Riff on a Martini", "Has Martini Rosso", the description around the word,
 * "Matched the bar's name"; a name match that isn't the style says so.
 */
export function matchWhy(match: DrinkMatch | null | undefined, description: string | null, search: string, name = ''): string | null {
  if (!match) return null;
  switch (match.kind) {
    case 'name':
      return name ? notTheStyle(name, search) : null;
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
 * While searching: every bar's pin shows its best match's drawing (its
 * picture) instead of the bar's logo, faded when that best match is a weak
 * one ("mentions Martini Rosso"); the bars of the best few matches, and the
 * selected bar, write its name on the pin instead of a count
 * (disc-search-map). `drinks` come best first, so a bar's first is its best.
 */
export function namePins(
  pins: readonly MapPin[],
  drinks: readonly { barId: string; name: string; imageUrl?: string | null; match?: DrinkMatch | null }[],
  selectedId: string | null
): MapPin[] {
  const best = new Map<string, (typeof drinks)[number]>();
  for (const d of drinks) if (!best.has(d.barId)) best.set(d.barId, d);
  const named = new Set([...best.keys()].slice(0, NAMED));
  if (selectedId) named.add(selectedId);
  return pins.map((p) => {
    const top = best.get(p.id);
    if (!top || p.closed) return { ...p, showCount: true };
    const look = { image: top.imageUrl ?? null, weak: !isStrong(top.match) };
    return named.has(p.id) ? { ...p, ...look, top: top.name } : { ...p, ...look, showCount: true };
  });
}

/** A bar's page, opened on what was searched (`?q=`), so its matches come first there. */
export function barSearchHref(ref: string, search: string): string {
  const q = search.trim();
  return q ? `/p/${ref}?q=${encodeURIComponent(q)}` : `/p/${ref}`;
}

/**
 * "5 bars near you pour the classic, 2 pour a variation" (disc-search-map):
 * by bar, a bar with the classic's own spec counts as pouring the classic
 * even if it also pours a variation. Null when no bar pours either.
 */
export function classicSummary(drinks: readonly { id: string; barId: string }[], verdicts: Readonly<Record<string, { spec_match: string }>>, where: string): string | null {
  const classic = new Set<string>();
  const variation = new Set<string>();
  for (const d of drinks) {
    const v = verdicts[d.id]?.spec_match;
    if (v === 'same') classic.add(d.barId);
    else if (v === 'variation') variation.add(d.barId);
  }
  for (const b of classic) variation.delete(b);
  const bars = (n: number) => `${n} ${n === 1 ? 'bar' : 'bars'}`;
  const pour = (n: number) => (n === 1 ? 'pours' : 'pour');
  if (classic.size && variation.size) return `${bars(classic.size)} ${where} ${pour(classic.size)} the classic, ${variation.size} ${pour(variation.size)} a variation`;
  if (classic.size) return `${bars(classic.size)} ${where} ${pour(classic.size)} the classic`;
  if (variation.size) return `${bars(variation.size)} ${where} ${pour(variation.size)} a variation`;
  return null;
}

/**
 * The searched results' heading (disc-search-map): "Martinis and more" when
 * the search names a style, else the search itself in quotes.
 */
export function searchTitle(search: string): string {
  const q = foldName(search);
  const style = q ? STYLES.find((s) => s.name?.test(q)) : undefined;
  return style ? `${style.label} and more` : `“${search.trim()}”`;
}
