/**
 * The drinks a person has had, as their profile shows them: every drink they
 * ranked, with their own 0 to 10 score, where they had it, their favourites,
 * and how each bar did across the drinks they had there. Like the "Been" list
 * on Beli, with the bar tally on top. Pure helpers (lib/hadDrinks.check.ts);
 * the queries are in hooks/useRankings.ts.
 */
import { heroPicture, type ItemImageLink } from './itemImages';
import type { Sentiment } from './ranking';

/** Where a drink was had: a bar's public profile. */
export interface HadVenue {
  id: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  /** "Fitzroy, Melbourne" */
  place: string | null;
}

/** One drink someone had. Plain JSON (the query cache is persisted). */
export interface HadDrink {
  id: string;
  itemId: string;
  name: string;
  /** The list it's ranked in, when that isn't the drink itself: "Martini". */
  listName: string | null;
  imageUrl: string | null;
  isSketch: boolean;
  /** Null: made at home. */
  venue: HadVenue | null;
  sentiment: Sentiment;
  score: number;
  hadOn: string | null;
  createdAt: string;
}

/** A rank_entry_scores row with its drink, list and bar embedded. */
export interface HadRow {
  id: string;
  item_id: string;
  sentiment: Sentiment;
  had_on: string | null;
  created_at: string;
  score: number | string;
  item: { name: string; item_images: ItemImageLink[] | null } | null;
  list: { name: string } | null;
  venue: { id: string; handle: string | null; display_name: string; avatar_url: string | null; locality: string | null; city: string | null } | null;
}

/** A drink the reader can no longer open (its bar unpublished it) keeps its list's name. */
export function toHadDrink(row: HadRow): HadDrink {
  const hero = heroPicture(row.item?.item_images);
  const name = row.item?.name ?? row.list?.name ?? 'A drink';
  return {
    id: row.id,
    itemId: row.item_id,
    name,
    listName: row.list?.name && row.list.name !== name ? row.list.name : null,
    imageUrl: hero?.url ?? null,
    isSketch: !!hero?.isSketch,
    venue: row.venue
      ? {
          id: row.venue.id,
          handle: row.venue.handle,
          name: row.venue.display_name,
          avatarUrl: row.venue.avatar_url,
          place: [row.venue.locality, row.venue.city].filter(Boolean).join(', ') || null,
        }
      : null,
    sentiment: row.sentiment,
    score: Number(row.score),
    hadOn: row.had_on,
    createdAt: row.created_at,
  };
}

/** A get_profile_drinks row: someone else's drink, already cut down to what may be shown. */
export interface SharedHadRow {
  id: string;
  item_id: string;
  name: string;
  list_name: string | null;
  image_url: string | null;
  image_is_generated: boolean | null;
  venue_id: string | null;
  venue_handle: string | null;
  venue_name: string | null;
  venue_avatar_url: string | null;
  venue_locality: string | null;
  venue_city: string | null;
  sentiment: Sentiment;
  score: number | string;
  had_on: string | null;
  created_at: string;
}

export function fromSharedRow(row: SharedHadRow): HadDrink {
  return {
    id: row.id,
    itemId: row.item_id,
    name: row.name,
    listName: row.list_name,
    imageUrl: row.image_url,
    isSketch: !!row.image_is_generated,
    venue: row.venue_id
      ? {
          id: row.venue_id,
          handle: row.venue_handle,
          name: row.venue_name ?? 'A bar',
          avatarUrl: row.venue_avatar_url,
          place: [row.venue_locality, row.venue_city].filter(Boolean).join(', ') || null,
        }
      : null,
    sentiment: row.sentiment,
    score: Number(row.score),
    hadOn: row.had_on,
    createdAt: row.created_at,
  };
}

export type HadSort = 'score' | 'recent';

/** When it was had: the day they gave, else when they ranked it. */
const when = (d: HadDrink) => d.hadOn ?? d.createdAt.slice(0, 10);

const byScore = (a: HadDrink, b: HadDrink) => b.score - a.score || when(b).localeCompare(when(a)) || a.name.localeCompare(b.name);
const byRecent = (a: HadDrink, b: HadDrink) => when(b).localeCompare(when(a)) || b.createdAt.localeCompare(a.createdAt);

/** Best first, or latest first. */
export function sortHad(drinks: readonly HadDrink[], sort: HadSort): HadDrink[] {
  return [...drinks].sort(sort === 'score' ? byScore : byRecent);
}

/**
 * Favourites: the drinks they loved, best first. A score is a place in one
 * list ("my martinis"), so the top of every list is a 10; ties go to the
 * latest.
 */
export function favourites(drinks: readonly HadDrink[], limit = 6): HadDrink[] {
  return sortHad(drinks.filter((d) => d.sentiment === 'loved'), 'score').slice(0, limit);
}

/** Their scores at one bar (or at home), across every drink they had there. */
export interface BarTally {
  /** The bar's profile id, or 'home'. */
  key: string;
  venue: HadVenue | null;
  drinks: number;
  /** The mean of their scores there, to one decimal. */
  average: number;
  best: { name: string; score: number };
}

const mean = (scores: number[]) => Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10;

/** One row per bar, best average first; more drinks breaks a tie. */
export function tallyBars(drinks: readonly HadDrink[]): BarTally[] {
  const groups = new Map<string, HadDrink[]>();
  for (const d of drinks) {
    const key = d.venue?.id ?? 'home';
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.entries()]
    .map(([key, had]) => {
      const best = sortHad(had, 'score')[0];
      return { key, venue: had[0].venue, drinks: had.length, average: mean(had.map((d) => d.score)), best: { name: best.name, score: best.score } };
    })
    .sort((a, b) => b.average - a.average || b.drinks - a.drinks || (a.venue?.name ?? '').localeCompare(b.venue?.name ?? ''));
}

/** The numbers under a profile's name. Bars leaves home out. */
export function hadStats(drinks: readonly HadDrink[]): { drinks: number; bars: number } {
  return { drinks: drinks.length, bars: new Set(drinks.map((d) => d.venue?.id).filter(Boolean)).size };
}

/** "Bar Bellamy, Carlton" or "At home". */
export function whereLine(d: Pick<HadDrink, 'venue'>): string {
  return d.venue ? [d.venue.name, d.venue.place?.split(', ')[0]].filter(Boolean).join(', ') : 'At home';
}
