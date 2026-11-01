/**
 * Search over the spec books on this phone (lib/specBook.ts), answering on
 * every keystroke with no network, in three tiers:
 *
 * 1. Names: the exact name (0), the name's start (1), a word's start for
 *    every typed word (2), anywhere in the name (3).
 * 2. What's in it and around it: every typed word starts a word of the name,
 *    an ingredient (4), a tag such as the method, family, glass or ice (5),
 *    or a maker (6).
 *
 * One letter only looks at the starts of names and their words: "n" means
 * Negroni, not every drink with an n in it or in a line.
 * 3. Near misses, only when the first two found little: the "Did you mean"
 *    rule every search shares (lib/nearName.ts), 10 and up.
 *
 * Names fold as the database folds them (accents off, lower case), so
 * "vieux carre" finds Vieux Carré. Each book's index is built once and
 * kept; a query that extends the last one only rescans the last matches.
 * Pure; timings in lib/specSearch.check.ts.
 */
import { nearFold, nearMatcher } from '@/lib/nearName';
import type { DatabaseItem } from '@/types/types';

export interface SearchHit {
  item: DatabaseItem;
  barId: string;
  tier: 1 | 2 | 3;
  /** Lower is closer: see the tiers above. */
  score: number;
  /** The folded name, for ordering without the slower locale compare. */
  key: string;
}

interface Entry {
  item: DatabaseItem;
  barId: string;
  name: string;
  words: string[];
  ingredients: string[];
  tags: string[];
  makers: string[];
}

export interface SearchIndex {
  entries: Entry[];
}

const wordsOf = (text: string | null | undefined): string[] => nearFold(text).split(/[^a-z0-9]+/).filter(Boolean);

/** Each name once, every word of each, folded. */
function bag(names: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const name of names) for (const word of wordsOf(name)) out.add(word);
  return [...out];
}

/** Builds the index for one venue's items. Built once per book (specIndex). */
export function buildSearchIndex(barId: string, items: readonly DatabaseItem[]): SearchIndex {
  return {
    entries: items
      .filter((item) => !!item.id && !!item.name)
      .map((item) => ({
        item,
        barId,
        name: nearFold(item.name),
        words: wordsOf(item.name),
        ingredients: bag((item.recipes ?? []).map((line) => line.ingredient?.name)),
        tags: bag([
          ...(item.item_methods ?? []).map((m) => m.method?.name),
          item.family?.name,
          item.glassware?.name,
          item.ice?.name,
          item.service_style,
          item.ingredient_role === 'prep' ? 'house made' : null,
        ]),
        makers: bag([item.brand_maker]),
      })),
  };
}

const startsAny = (words: readonly string[], typed: string) => words.some((w) => w.startsWith(typed));

/** Tiers 1 and 2 for one entry: its score, or null. `full`: two letters or more. */
function scoreEntry(entry: Entry, q: string, typed: readonly string[], full: boolean): number | null {
  if (entry.name === q) return 0;
  if (entry.name.startsWith(q)) return 1;
  if (typed.every((t) => startsAny(entry.words, t))) return 2;
  if (!full) return null;
  if (entry.name.includes(q)) return 3;
  let score = 0;
  for (const t of typed) {
    if (startsAny(entry.words, t)) continue;
    if (startsAny(entry.ingredients, t)) score = Math.max(score, 4);
    else if (startsAny(entry.tags, t)) score = Math.max(score, 5);
    else if (startsAny(entry.makers, t)) score = Math.max(score, 6);
    else return null;
  }
  return score;
}

// The last query on each index and the entries it matched: the next letter
// narrows those rather than the whole book. Only after a full query: one
// letter matched by fewer rules than two do.
const lastScan = new WeakMap<SearchIndex, { q: string; matched: Entry[] }>();
const FULL_FROM = 2;

/** Tiers 1 and 2: names, then ingredients, tags and makers. Cheap enough for every keystroke. */
export function searchNames(index: SearchIndex, query: string): SearchHit[] {
  const q = nearFold(query);
  const typed = q.split(/[^a-z0-9]+/).filter(Boolean);
  if (!typed.length) return [];
  const full = q.length >= FULL_FROM;
  const last = lastScan.get(index);
  const pool = last && last.q.length >= FULL_FROM && q.startsWith(last.q) ? last.matched : index.entries;
  const hits: SearchHit[] = [];
  const matched: Entry[] = [];
  for (const entry of pool) {
    const score = scoreEntry(entry, q, typed, full);
    if (score === null) continue;
    matched.push(entry);
    hits.push({ item: entry.item, barId: entry.barId, tier: score < 4 ? 1 : 2, score, key: entry.name });
  }
  lastScan.set(index, { q, matched });
  return hits;
}

/** Tier 3: near misses on names, leaving out what tiers 1 and 2 found. Three letters or more. */
export function searchNear(index: SearchIndex, query: string, found: ReadonlySet<string>): SearchHit[] {
  if (nearFold(query).replace(/[^a-z0-9]/g, '').length < 3) return [];
  const near = nearMatcher(query);
  const hits: SearchHit[] = [];
  for (const entry of index.entries) {
    if (found.has(entry.item.id!)) continue;
    const score = near(entry.item.name!);
    if (score !== null) hits.push({ item: entry.item, barId: entry.barId, tier: 3, score: 10 + score, key: entry.name });
  }
  return hits;
}

/**
 * Closest first; among equals, what's on a list now (`onNow`), then the
 * shorter name, then A to Z. The same drink in two venues' books stays twice:
 * they're two venues' specs.
 */
export function rankHits(hits: SearchHit[], onNow: ReadonlySet<string> = new Set(), limit = 50): SearchHit[] {
  const on = (h: SearchHit) => (onNow.has(h.item.id!) ? 0 : 1);
  return hits
    .sort((a, b) => a.score - b.score || on(a) - on(b) || a.key.length - b.key.length || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, limit);
}

/** When the first two tiers are this thin, tier 3 runs. */
export const NEAR_BELOW = 5;
