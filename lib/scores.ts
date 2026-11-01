// What a drink's and a bar's scores say, in words (Loop-ladder, Red-score,
// Kept-score, Loop-reasons). Pure, so lib/scores.check.ts can hold the rules.
import { DRINK_REASONS, monthHad, ordinal, ROOM_REASONS } from './rankResult';
import { formatScore, plural } from './ranking';
import { FLOORS } from './scoreLadder';

/** get_drink_score: one bar drink's public score (20261206210000_score_recency.sql). */
export interface DrinkScore {
  name: string;
  /** The list it sits in: "Negroni" for a bar's Negroni. */
  ranked_as_name: string;
  venue_profile_id: string;
  bar_name: string;
  city: string | null;
  postcode: string | null;
  country_code: string | null;
  ranked_as_item_id: string;
  floor: number;
  /** People so far, every spec. */
  rankers: number;
  /** Null below the floor. */
  score: number | null;
  /** People who ranked the current spec. */
  current_rankers: number | null;
  version: number | null;
  /** When the current spec began; null for a drink never changed. */
  spec_since: string | null;
  recent: number | null;
  older: number | null;
  previous: { version: number; score: number; rankers: number; from: string | null; to: string } | null;
  history: { month: string; score: number; version: number | null }[];
  city_list: AreaPlace | null;
  postcode_list: AreaPlace | null;
  bar: { floor: number; ranks: number; since: string | null; score: number | null };
  list_floor: number;
}

export interface AreaPlace {
  name: string | null;
  bars: number;
  position: number;
}

/** get_bar_score: a bar's score from its drinks, and its best three. */
export interface BarScore {
  floor: number;
  ranks: number;
  rankers: number;
  drinks: number;
  city: string | null;
  score: number | null;
  best: {
    item_id: string;
    name: string;
    ranked_as_item_id: string;
    ranked_as_name: string;
    image_url: string | null;
    image_is_generated: boolean | null;
    score: number;
    rankers: number;
    city_position: number;
    city_bars: number;
  }[];
}

/** Reason or room totals, by key. */
export type Tally = Record<string, number>;

/** get_drink_guest_says: one drink's ranks by spec version, totals once each passes the floor. */
export interface DrinkGuestSays {
  floor: number;
  versions: { version: number; since: string | null; rankers: number; liked: number | null; fine: number | null; not_for_me: number | null; reasons: Tally | null }[];
}

export interface MyDrinkSays {
  item_id: string;
  name: string;
  rankers: number;
  liked: number | null;
  reasons: Tally | null;
  floor: number;
}

/** get_bar_guest_says: the room, for the bar's Admins. */
export interface BarGuestSays {
  floor: number;
  people: number;
  room_people: number;
  score: number | null;
  menu: string | null;
  change: number | null;
  room: Tally | null;
}

/** Numbers from jsonb come back as numbers already; Postgres numerics in a table come back as strings. */
export const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));

// --- the ladder on a bar drink's page ---

/**
 * Which rung the drink has reached (Loop-ladder steps): 1 you and friends,
 * 2 the bar's drinks together, 3 its own score, 4 the city list, 5 the
 * postcode list. A list counts once FLOORS.listBars bars are on it.
 */
export function ladderStep(s: Pick<DrinkScore, 'score' | 'bar' | 'city_list' | 'postcode_list' | 'list_floor'>): 1 | 2 | 3 | 4 | 5 {
  if (s.score == null) return s.bar.score != null ? 2 : 1;
  const floor = s.list_floor || FLOORS.listBars;
  if ((s.postcode_list?.bars ?? 0) >= floor) return 5;
  if ((s.city_list?.bars ?? 0) >= floor) return 4;
  return 3;
}

/** Rung 1: "Not enough rankers yet in New York. A bar's Negroni shows here once 20 people have ranked it there." */
export function belowFloorNote(name: string, city: string | null, floor: number = FLOORS.people): string {
  return `Not enough rankers yet${city ? ` in ${city}` : ''}. A bar’s ${name} shows here once ${floor} people have ranked it there.`;
}

const MONTH = new Intl.DateTimeFormat('en', { month: 'long' });
// "31 Oct", as the boards write a day.
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayOf = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);

/** When a version went on: a weekday within the week ("Monday"), else "31 Oct". */
export function sinceDay(iso: string, now = new Date()): string {
  const day = dayOf(iso);
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - day.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days > 0 && days < 7) return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(day);
  return DAY_MONTH.format(day);
}

/** "64 ranks since September", the bar's drinks together. */
export function barRanksLine(ranks: number, since: string | null): string {
  return `${ranks} ${ranks === 1 ? 'rank' : 'ranks'}${since ? ` since ${MONTH.format(dayOf(since))}` : ''}`;
}

/** "12 of 20" to its own score. */
export const floorProgress = (rankers: number, floor: number) => `${Math.min(rankers, floor)} of ${floor}`;

/** Rung 3: "New York lists come next: 4 more bars need this drink on the list." Null without a city. */
export function listsNextLine(s: Pick<DrinkScore, 'city' | 'city_list' | 'list_floor'>): string | null {
  if (!s.city) return null;
  const more = Math.max(1, (s.list_floor || FLOORS.listBars) - (s.city_list?.bars ?? 0));
  return `${s.city} lists come next: ${more} more ${more === 1 ? 'bar needs' : 'bars need'} this drink on the list.`;
}

/** Rung 5, under the postcode list: "#3 in New York. See the city." */
export function cityPlaceLine(s: Pick<DrinkScore, 'city' | 'city_list'>): string | null {
  return s.city && s.city_list ? `#${s.city_list.position} in ${s.city}.` : null;
}

/** "Your 2nd best" over your score, "of 7 Negronis" under it. Null when you haven't ranked it. */
export function yourPlace(list: readonly { item_id: string; score: number }[], itemId: string, name: string): { title: string; score: string; sub: string } | null {
  const at = list.findIndex((e) => e.item_id === itemId);
  if (at < 0) return null;
  return {
    title: at === 0 ? 'Your best' : `Your ${ordinal(at + 1)} best`,
    score: formatScore(list[at].score),
    sub: list.length === 1 ? `your first ${name}` : `of ${list.length} ${plural(name)}`,
  };
}

// --- a drink's score page ---

/** Under the big score: what it's from. */
export function scoreFromLine(s: Pick<DrinkScore, 'rankers' | 'current_rankers' | 'spec_since' | 'version' | 'previous'>): string {
  if (s.spec_since && s.current_rankers) {
    return `From ${s.current_rankers} ${s.current_rankers === 1 ? 'rank' : 'ranks'} since the spec changed on ${DAY_MONTH.format(dayOf(s.spec_since))}`;
  }
  if (s.spec_since) return `Version ${s.version} has no ranks yet, so this is the score before it`;
  return `From ${s.rankers} ranks, newest count most`;
}

/** "Version 4: 8.9, from 62 ranks, 3 Oct to 31 Oct" */
export function previousLine(p: NonNullable<DrinkScore['previous']>): string {
  const span = [p.from, p.to].filter((d): d is string => !!d).map((d) => DAY_MONTH.format(dayOf(d)));
  return `Version ${p.version}: ${formatScore(p.score)}, from ${p.rankers} ranks${span.length === 2 ? `, ${span[0]} to ${span[1]}` : ''}`;
}

/** The history's month marks: every other month, as the board marks Jun, Aug, Oct. */
export function monthMarks(history: readonly { month: string }[]): { index: number; label: string }[] {
  const short = new Intl.DateTimeFormat('en', { month: 'short' });
  const last = history.length - 1;
  return history.flatMap((h, i) => ((last - i) % 2 === 0 ? [{ index: i, label: short.format(dayOf(h.month)) }] : []));
}

/** Where the spec changed in the history: the first point of the newest version, when there's an older one before it. */
export function versionMark(history: readonly { version: number | null }[]): number | null {
  const v = history[history.length - 1]?.version;
  if (v == null) return null;
  const at = history.findIndex((h) => h.version === v);
  return at > 0 ? at : null;
}

// --- what guests say ---

const NEGATIVE = new Set(['too_sweet', 'too_strong', 'watery', 'loud', 'cramped', 'too_dark']);
export const isNegative = (key: string) => NEGATIVE.has(key);

const LABELS: Record<string, string> = Object.fromEntries([...DRINK_REASONS, ...ROOM_REASONS].map((r) => [r.key, r.label]));
export const reasonLabel = (key: string) => LABELS[key] ?? key.replace(/_/g, ' ');

/** Totals for a meter, most first; keys the app doesn't know yet keep their own words. */
export function tallyRows(tally: Tally | null, order: readonly { key: string }[]): { key: string; label: string; n: number; negative: boolean }[] {
  if (!tally) return [];
  const known = order.map((r) => r.key);
  const keys = [...known.filter((k) => tally[k]), ...Object.keys(tally).filter((k) => !known.includes(k) && tally[k])];
  return keys.map((k) => ({ key: k, label: reasonLabel(k), n: tally[k], negative: isNegative(k) })).sort((a, b) => b.n - a.n);
}

/**
 * One line for a credited drink (Loop-reasons "Your drinks"): "31 liked ·
 * mostly Would order again", "22 liked · 4 say too sweet" when a complaint
 * comes from at least a tenth of people, "7 ranks · reasons show at 20".
 */
export function myDrinkLine(d: Pick<MyDrinkSays, 'rankers' | 'liked' | 'reasons' | 'floor'>): string {
  if (d.liked == null) return `${d.rankers} ${d.rankers === 1 ? 'rank' : 'ranks'} · reasons show at ${d.floor}`;
  const rows = tallyRows(d.reasons, DRINK_REASONS);
  const complaint = rows.find((r) => r.negative && r.n * 10 >= d.rankers);
  const praise = rows.find((r) => !r.negative);
  const tail = complaint ? `${complaint.n} say ${complaint.label.toLowerCase()}` : praise ? `mostly ${praise.label}` : null;
  return [`${d.liked} liked`, tail].filter(Boolean).join(' · ');
}

/** When someone had it, as the ladder's people rows say it: "Tonight", "Yesterday", "Last week", then the month. */
export function whenHad(entry: { had_on: string | null; created_at: string }, now = new Date()): string {
  const day = new Date(`${(entry.had_on ?? entry.created_at).slice(0, 10)}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (days <= 0) return 'Tonight';
  if (days === 1) return 'Yesterday';
  if (days < 14) return 'Last week';
  return monthHad(entry, now);
}

/** "Up 0.2 since Winter went on", "Down 0.1 since…", "No change since…". Null without a menu or a change. */
export function changeLine(change: number | null, menu: string | null): string | null {
  if (change == null || !menu) return null;
  const r = Math.round(change * 10) / 10;
  if (r === 0) return `No change since ${menu} went on`;
  return `${r > 0 ? 'Up' : 'Down'} ${Math.abs(r).toFixed(1)} since ${menu} went on`;
}

/** Bar page: "From 14 ranked drinks, 212 ranks · #3 near you" (the place when known). */
export function barScoreLine(s: Pick<BarScore, 'drinks' | 'ranks'>, place?: string | null): string {
  return [`From ${s.drinks} ranked ${s.drinks === 1 ? 'drink' : 'drinks'}, ${s.ranks} ranks`, place].filter(Boolean).join(' · ');
}

/** "#1 Jack Rose in the city" under one of a bar's best drinks. */
export function bestPlaceLine(d: Pick<BarScore['best'][number], 'city_position' | 'city_bars' | 'ranked_as_name' | 'name'>): string {
  if (d.city_bars < 2) return d.ranked_as_name === d.name ? 'Only here' : `${d.ranked_as_name} here`;
  return `#${d.city_position} ${d.ranked_as_name} in the city`;
}
