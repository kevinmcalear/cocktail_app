/**
 * Collection's stages (boards home-collection-drinks and -bars): Had out, To
 * make and Made for drinks; Want to go and Been for bars. The tiles switch
 * the list under them. Pure helpers (lib/collectionStages.check.ts); the
 * data comes from useMyHadDrinks, useCollection, useMadeDrinks, useMyBar and
 * useLovedBars; Want to go's map pins its bars as Discover does (lib/discoverMap.ts).
 */
import { averageScore } from './collectionMenus';
import { cameraFor, type Camera, type MapPin } from './discoverMap';
import type { HadDrink, HadVenue } from './hadDrinks';
import type { MadeTally } from './madeIt';
import type { AwayGroup } from './toMake';

export type DrinkStage = 'had' | 'make' | 'made';
export type BarStage = 'want' | 'been';

/** What the shelf says about a drink: makeable, one or two bottles off (which), or further. */
export interface ShelfMatch {
  canMakeIds: ReadonlySet<string>;
  oneAway: readonly AwayGroup[];
  twoAway: readonly AwayGroup[];
}

export type HomeReach = { kind: 'ready' } | { kind: 'one' | 'two'; need: string[] } | { kind: 'far' };

export function homeReach(itemId: string | null, shelf: ShelfMatch): HomeReach {
  if (!itemId) return { kind: 'far' };
  if (shelf.canMakeIds.has(itemId)) return { kind: 'ready' };
  for (const kind of ['one', 'two'] as const) {
    const group = (kind === 'one' ? shelf.oneAway : shelf.twoAway).find((g) => g.drinks.some((d) => d.id === itemId));
    if (group) return { kind, need: group.bottles.map((b) => b.name) };
  }
  return { kind: 'far' };
}

/** "Need Cynar", "Need Campari and pineapple juice". */
export const needLine = (need: readonly string[]) => `Need ${need.join(' and ')}`;

/**
 * The end of a home menu's drink row (menus-one-look, BandMenu): "Ready", or
 * "Need 1" / "Need 2" and which bottles. Nothing when the shelf is further off.
 */
export function menuRowShelf(itemId: string, shelf: ShelfMatch): { label: string; ready: boolean; need: string[] } | null {
  const reach = homeReach(itemId, shelf);
  if (reach.kind === 'ready') return { label: 'Ready', ready: true, need: [] };
  if (reach.kind === 'far' || !reach.need.length) return null;
  return { label: `Need ${reach.need.length}`, ready: false, need: reach.need };
}

/** "+0.3", "−0.7", "0.0": your version's score against the bar's. */
export function gapLabel(you: number, bar: number): string {
  const gap = Math.round((you - bar) * 10) / 10;
  return gap > 0 ? `+${gap.toFixed(1)}` : gap < 0 ? `−${Math.abs(gap).toFixed(1)}` : '0.0';
}

/** "12 Oct", or "12 Oct 2025" when it isn't this year. Days, not instants: no time zone shift. */
export function dayShort(day: string, now: number, locale?: string): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  const sameYear = y === new Date(now).getFullYear();
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

// --- Had out ---

export type HadSort = 'best' | 'recent' | 'bar';

export type HadStatus =
  | { kind: 'off' }
  | { kind: 'made'; score: number | null }
  | { kind: 'locked' }
  | HomeReach;

export interface HadOutRow {
  key: string;
  itemId: string | null;
  name: string;
  imageUrl: string | null;
  bar: string | null;
  /** When you had it, as a day. */
  day: string | null;
  score: number | null;
  status: HadStatus;
  /** A drink the bar took off its public menu: it opens as a memory (MemorySheet), by its collection row. */
  memoryId?: string;
}

/** A Collection drink, cut to what Had out needs: past ones become rows, locked ones say so. */
export interface HadMemory {
  id: string;
  itemId: string | null;
  name: string;
  imageUrl: string | null;
  barName: string | null;
  hadOn: string | null;
  past: boolean;
  locked: boolean;
}

/**
 * Every drink you had at a bar, once each (your best score for it), plus
 * past drinks you kept that you never scored. Each says whether you made it
 * at home, can make it, or what you'd need; a past one says it's off the menu.
 */
export function hadOutRows(had: readonly HadDrink[], kept: readonly HadMemory[], shelf: ShelfMatch, sort: HadSort): HadOutRow[] {
  const home = new Map<string, number>();
  for (const h of had) if (!h.venue && !h.atBar) home.set(h.itemId, Math.max(h.score, home.get(h.itemId) ?? 0));
  const memory = new Map(kept.filter((k) => k.itemId).map((k) => [k.itemId!, k]));
  const status = (itemId: string | null): HadStatus => {
    const k = itemId ? memory.get(itemId) : undefined;
    if (k?.past) return { kind: 'off' };
    if (itemId && home.has(itemId)) return { kind: 'made', score: home.get(itemId)! };
    if (k?.locked) return { kind: 'locked' };
    return homeReach(itemId, shelf);
  };
  const best = new Map<string, HadDrink>();
  for (const h of had) {
    if (!h.venue && !h.atBar) continue;
    const was = best.get(h.itemId);
    if (!was || h.score > was.score) best.set(h.itemId, h);
  }
  const rows: HadOutRow[] = [...best.values()].map((h) => ({
    key: h.id,
    itemId: h.itemId,
    name: h.name,
    imageUrl: h.imageUrl,
    bar: h.venue?.name ?? null,
    day: h.hadOn ?? (h.createdAt ? h.createdAt.slice(0, 10) : null),
    score: h.score,
    status: status(h.itemId),
    memoryId: h.itemId ? (memory.get(h.itemId)?.past ? memory.get(h.itemId)!.id : undefined) : undefined,
  }));
  for (const k of kept) {
    if (!k.past || (k.itemId && best.has(k.itemId))) continue;
    rows.push({ key: k.id, itemId: k.itemId, name: k.name, imageUrl: k.imageUrl, bar: k.barName, day: k.hadOn, score: null, status: { kind: 'off' }, memoryId: k.id });
  }
  const byScore = (a: HadOutRow, b: HadOutRow) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name);
  const byDay = (a: HadOutRow, b: HadOutRow) => (b.day ?? '').localeCompare(a.day ?? '') || byScore(a, b);
  if (sort === 'recent') return rows.sort(byDay);
  if (sort === 'bar') return rows.sort((a, b) => (a.bar ?? '￿').localeCompare(b.bar ?? '￿') || byScore(a, b));
  return rows.sort(byScore);
}

// --- To make ---

export type MakeGroupKey = 'ready' | 'one' | 'more' | 'locked';

export interface MakeGroup<T> {
  key: MakeGroupKey;
  title: string;
  drinks: { drink: T; reach: HomeReach }[];
}

const GROUP_TITLES: Record<MakeGroupKey, string> = { ready: 'Ready now', one: 'One bottle away', more: 'Need more', locked: 'Spec not public' };

/** To make in groups: ready now, one bottle away, more than that, and bar drinks whose spec isn't open. Saved order within each. */
export function toMakeGroups<T extends { itemId: string | null; locked: boolean }>(drinks: readonly T[], shelf: ShelfMatch): MakeGroup<T>[] {
  const groups = new Map<MakeGroupKey, MakeGroup<T>>((['ready', 'one', 'more', 'locked'] as const).map((key) => [key, { key, title: GROUP_TITLES[key], drinks: [] }]));
  for (const drink of drinks) {
    const reach = homeReach(drink.itemId, shelf);
    const key: MakeGroupKey = drink.locked ? 'locked' : reach.kind === 'ready' ? 'ready' : reach.kind === 'one' ? 'one' : 'more';
    groups.get(key)!.drinks.push({ drink, reach });
  }
  return [...groups.values()].filter((g) => g.drinks.length);
}

/** The bottle that opens the most of your To make list ("Buy Cynar, make 2 more"), or null when none would. */
export function nextBottle<T extends { itemId: string | null; name: string }>(drinks: readonly T[], oneAway: readonly AwayGroup[]): { bottles: AwayGroup['bottles']; drinks: T[] } | null {
  let pick: { bottles: AwayGroup['bottles']; drinks: T[] } | null = null;
  for (const g of oneAway) {
    const opens = drinks.filter((d) => d.itemId && g.drinks.some((x) => x.id === d.itemId));
    if (opens.length && (!pick || opens.length > pick.drinks.length)) pick = { bottles: g.bottles, drinks: opens };
  }
  return pick;
}

// --- Made ---

export interface MadeRow {
  tally: MadeTally;
  /** Your score for your version, when you ranked it. */
  you: number | null;
  /** Your score for the bar's version, when you had it out. */
  bar: number | null;
  barName: string | null;
  classic: boolean;
}

/** Each drink you made, with your score for it beside your score for the bar's. */
export function madeRows(tallies: readonly MadeTally[], had: readonly HadDrink[], classics: ReadonlySet<string>): MadeRow[] {
  return tallies.map((tally) => {
    const home = had.filter((h) => h.itemId === tally.itemId && !h.venue && !h.atBar);
    const out = had.filter((h) => h.itemId === tally.itemId && (h.venue || h.atBar));
    const top = (list: HadDrink[]) => (list.length ? Math.max(...list.map((h) => h.score)) : null);
    const barName = out.find((h) => h.venue)?.venue?.name ?? null;
    return { tally, you: top(home), bar: top(out), barName, classic: classics.has(tally.itemId) };
  });
}

/** How many of your versions scored higher than you gave the bar's: "3 beat the bar". A draw isn't a win. */
export const beatCount = (rows: readonly MadeRow[]) => rows.filter((r) => r.you !== null && r.bar !== null && r.you > r.bar).length;

// --- Bars ---

export interface BeenBar {
  venue: HadVenue;
  /** Your score for the bar: the average of your scores for the drinks you had there. */
  yours: number;
  drinks: number;
  best: { name: string; score: number };
  /** The last day you had a drink there. */
  last: string | null;
}

export type BeenSort = 'score' | 'recent';

/** The bars you've had drinks at, from your scores there. */
export function beenBars(had: readonly HadDrink[], sort: BeenSort): BeenBar[] {
  const byBar = new Map<string, HadDrink[]>();
  for (const h of had) if (h.venue) byBar.set(h.venue.id, [...(byBar.get(h.venue.id) ?? []), h]);
  const bars = [...byBar.values()].map((list): BeenBar => {
    const top = list.reduce((a, b) => (b.score > a.score ? b : a));
    const days = list.map((h) => h.hadOn ?? (h.createdAt ? h.createdAt.slice(0, 10) : '')).filter(Boolean).sort();
    return { venue: list[0].venue!, yours: averageScore(list.map((h) => h.score))!, drinks: list.length, best: { name: top.name, score: top.score }, last: days.at(-1) ?? null };
  });
  if (sort === 'recent') return bars.sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '') || b.yours - a.yours);
  return bars.sort((a, b) => b.yours - a.yours || a.venue.name.localeCompare(b.venue.name));
}

/** The order Want to go lists bars: nearest first when we know where you are, else by name. Unknown distances go last. */
export function nearestFirst<T extends { name: string; km: number | null }>(bars: readonly T[]): T[] {
  return [...bars].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || a.name.localeCompare(b.name));
}

/** A bar on Want to go: how far, open tonight or not, why it's here, everyone's score. */
export interface WantBar {
  id: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  place: string | null;
  latitude: number | null;
  longitude: number | null;
  away: string | null;
  km: number | null;
  hours: { open: boolean; text: string } | null;
  why: string | null;
  everyone: number | null;
}

/** How near a Want to go bar must be for the map to open on it (board home-collection-bars, step 3). */
export const WANT_NEAR_KM = 25;

/** Want to go's bars as Discover's pins: everyone's score on each, a plain dot until there is one. */
export function wantPins(bars: readonly WantBar[]): MapPin[] {
  return bars.flatMap((b) =>
    b.latitude !== null && b.longitude !== null
      ? [{ id: b.id, handle: b.handle || b.id, name: b.name, logo: b.avatarUrl, place: b.place ?? '', latitude: b.latitude, longitude: b.longitude, score: b.everyone, position: null, rankers: 0 }]
      : [],
  );
}

/** Where the map opens: on the bars near you, else on all of them. */
export function wantCamera(bars: readonly WantBar[]): Camera | null {
  // A distance means it has a place: km comes from its coordinates.
  const near = bars.filter((b) => b.km !== null && b.km <= WANT_NEAR_KM);
  return cameraFor(wantPins(near.length ? near : bars));
}
