/**
 * Discover's drinks at bars and the bars: the filters as the discover RPCs
 * take them, rows from them, finding bars by name, and map pins. Matching,
 * ranking and paging happen in SQL (supabase/migrations/20261009700000_discover_index.sql).
 * Pure; checked by lib/discoverDrinks.check.ts. The data comes from
 * hooks/useDiscoverDrinks.ts.
 */
import type { DisplayFace } from '../constants/tokens';
import { faceFromDb, markBrand } from './brand';
import { isHexColor } from './color';
import { foldName } from './discover';
import type { MapPin } from './discoverMap';
import { matchWhy, toMatch, type DrinkMatch } from './discoverMatch';
import { kindLabel, SPIRITS, STYLES } from './drinkStyles';
import { noteDimension } from './flavor';
import { menuOrder, runDates, searchMenuTag } from './menuEditions';
import type { Area, DiscoverRow } from './nearMe';

export interface DiscoverBar {
  id: string;
  handle: string;
  name: string;
  logo: string | null;
  locality: string | null;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Shut for good: kept for its history, off Discover's drinks and map unless asked for, still found by search. */
  closed: boolean;
  closedYear: number | null;
  /** How many of its drinks match Discover's filters (0 when closed). */
  drinks: number;
  /** With a search: how many of those are on one of its menus now (a server without 20261016200000 doesn't say). */
  onNow?: number | null;
  /** Its venue's public accent and face, for its monogram (BarMark); null when it has none. Undefined: not said (BarMark looks it up). */
  brand?: { accent: string; face: DisplayFace } | null;
}

/** A discover_bars row. */
export interface BarRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  locality: string | null;
  city: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_closed: boolean;
  closed_year: number | null;
  drinks: number;
  on_now?: number | null;
  /** Its venue's public accent and display face (bar_brands); a server without 20261016200000 doesn't say. */
  brand_accent?: string | null;
  brand_face?: string | null;
}

export function toDiscoverBar(r: BarRow): DiscoverBar {
  return {
    id: r.id,
    handle: r.handle,
    name: r.display_name,
    logo: r.avatar_url,
    locality: r.locality,
    city: r.city,
    countryCode: r.country_code,
    latitude: r.latitude,
    longitude: r.longitude,
    closed: r.is_closed,
    closedYear: r.closed_year,
    drinks: r.drinks,
    onNow: r.on_now ?? null,
    brand: 'brand_accent' in r ? markBrand({ accent: isHexColor(r.brand_accent) ? r.brand_accent : null, face: faceFromDb(r.brand_face) }) : undefined,
  };
}

export interface DiscoverDrink {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  barId: string;
  /** What a row says about its bar. */
  bar: { name: string; handle: string; logo: string | null; locality: string | null; city: string | null };
  /** Its bar's menus: on now, or past with when ("Past · Mar 2024 to Jan 2025"); order 0 on now, 1 not dated, 2 past; `since` when its menu began. */
  menu: { onNow: boolean; past: string | null; order: number; since?: { year: number; month: number | null } | null };
  /** Its styles ("martini", "zero-proof"); a server without 20261028100000 doesn't say. */
  styles?: string[];
  /** Mixed list (p_mix): its place in the list, the cursor for the next page; else null. */
  pos?: number | null;
  /** Where it sorts (discover_list's rank): with the name and id, the cursor for the next page. */
  rank: number;
  /** Why it matched the search (lib/discoverMatch.ts); null with no search. */
  match: DrinkMatch | null;
  /** That in words when the name doesn't say it: "Riff on a Martini", "Has Martini Rosso". */
  why: string | null;
  /** Sorted by Nearest: metres from where the list was asked from; else null. */
  distance: number | null;
}

/** A discover_list row. */
export interface DrinkRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  bar_profile_id: string;
  bar_handle: string;
  bar_name: string;
  bar_logo: string | null;
  bar_locality: string | null;
  bar_city: string | null;
  /** [start year, start month, end year, end month, 1 if on now], or null when never on a menu. */
  menu_run: [number, number | null, number | null, number | null, number] | null;
  rank: number;
  /** On the first page only. */
  total_drinks: number | null;
  total_bars: number | null;
  /** With a search: name, riff, line, description or bar; match_text names the classic or the ingredient. */
  match_kind?: string | null;
  match_text?: string | null;
  /** With p_from_latitude/longitude: metres to the bar. */
  distance_m?: number | null;
  styles?: string[] | null;
  /** With p_mix: its place in the mixed list. */
  mix_pos?: number | null;
}

/** Plain JSON for the query cache. `search`: what was searched, for the words on why it matched. */
export function toDiscoverDrink(r: DrinkRow, search = ''): DiscoverDrink {
  const match = toMatch(r.match_kind, r.match_text);
  const run = r.menu_run;
  const dates = run ? runDates({ start_year: run[0], start_month: run[1], end_year: run[2], end_month: run[3], is_current: run[4] === 1 }) : null;
  const tag = searchMenuTag(dates);
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    imageUrl: r.image_url,
    barId: r.bar_profile_id,
    bar: { name: r.bar_name, handle: r.bar_handle, logo: r.bar_logo, locality: r.bar_locality, city: r.bar_city },
    menu: { onNow: !!tag?.onNow, past: tag?.past ?? null, order: menuOrder(dates), since: run ? { year: run[0], month: run[1] } : null },
    styles: r.styles ?? [],
    pos: r.mix_pos ?? null,
    rank: r.rank,
    match,
    why: matchWhy(match, r.description, search, r.name),
    distance: r.distance_m ?? null,
  };
}

/** discover_list's cursor after a drink: its place in a mixed list, else its rank (or distance), name and id. */
export function cursorAfter(d: Pick<DiscoverDrink, 'id' | 'name' | 'rank' | 'distance' | 'pos'>) {
  if (d.pos !== null && d.pos !== undefined) return { p_after_pos: d.pos };
  return { p_after_rank: d.rank, p_after_name: d.name, p_after_id: d.id, ...(d.distance === null ? {} : { p_after_distance: d.distance }) };
}

/** How long a drink on a menu now reads as "New". */
const NEW_MONTHS = 3;

/**
 * The one short reason a mixed-list row carries, only when it's true: "New"
 * (on a menu that began in the last three months, dated to the month), else
 * "Zero-proof". Most rows carry none (Kevin, 15 Oct, option A).
 */
export function drinkReason(d: Pick<DiscoverDrink, 'menu' | 'styles'>, now: Date): string | null {
  const since = d.menu.since;
  if (d.menu.onNow && since?.month) {
    const months = (now.getFullYear() - since.year) * 12 + (now.getMonth() + 1 - since.month);
    if (months >= 0 && months < NEW_MONTHS) return 'New';
  }
  return d.styles?.includes('zero-proof') ? 'Zero-proof' : null;
}

const KM_PER_DEG = 111.045;

const STYLE_IDS = new Set(STYLES.map((s) => s.id));
const SPIRIT_IDS = new Set(SPIRITS.map((s) => s.id));

/**
 * Picked styles, spirits and tasting notes as the RPCs take them: any pick
 * within a group (Martinis or Negronis), every group picked (and Gin, and
 * Bitter). A group with no picks is null, so it doesn't narrow. Sorted, so
 * the same picks are the same query.
 */
export function kindParams(kinds: readonly string[]): { p_styles: string[] | null; p_spirits: string[] | null; p_notes: string[] | null } {
  const sorted = [...new Set(kinds)].sort();
  const of = (xs: string[]) => (xs.length ? xs : null);
  return {
    p_styles: of(sorted.filter((k) => STYLE_IDS.has(k))),
    p_spirits: of(sorted.filter((k) => SPIRIT_IDS.has(k))),
    p_notes: of(sorted.flatMap((k) => noteDimension(k) ?? [])),
  };
}

/** What the picked filters are called in a heading: "Drinks", "Martinis", "Martinis & Gin", "Drinks, 3 filters". */
export function kindsTitle(kinds: readonly string[]): string {
  if (!kinds.length) return 'Drinks';
  if (kinds.length > 2) return `Drinks, ${kinds.length} filters`;
  return kinds.map(kindLabel).join(' & ');
}

/** Great-circle distance in km. */
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "Closed 2019", or "Closed" when the year isn't known. */
export function closedLabel(year: number | null): string {
  return year ? `Closed ${year}` : 'Closed';
}

/** The closed bars in the area, by name: what "Closed bars" in Filters shows. */
export function closedBars(bars: readonly DiscoverBar[], area: Area): DiscoverBar[] {
  return bars.filter((b) => b.closed && barInArea(b, area)).sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether a bar is in the area. A bar with no coordinates is only "anywhere" (or in its city). */
export function barInArea(bar: DiscoverBar, area: Area): boolean {
  if (area.kind === 'anywhere') return true;
  if (area.kind === 'city') return !!bar.city && foldName(bar.city) === foldName(area.city) && bar.countryCode === area.country_code;
  if (bar.latitude === null || bar.longitude === null) return false;
  // A cheap box test first; most bars are nowhere near.
  if (Math.abs(bar.latitude - area.latitude) * KM_PER_DEG > area.radiusKm) return false;
  return distanceKm(area, { latitude: bar.latitude, longitude: bar.longitude }) <= area.radiusKm;
}

export interface DrinkFilter {
  /** Style, spirit and tasting-note ids; empty for every drink. */
  kinds: readonly string[];
  /** Typed search: every word must match the drink's name, description, ingredients or bar. */
  search: string;
  area: Area;
  /** "Not had yet": leave out the drinks you've had or ranked. */
  notHad?: boolean;
}

/**
 * "Not had yet": the drinks loaded so far without the ones you've had (your
 * rank entries), and the totals less those.
 * ponytail: filtered on the phone, a page at a time, so until every page is
 * in, the counts can run a little high (had drinks on pages still to load,
 * and bars where you've had everything). Upgrade: a p_not_had argument on
 * discover_list and discover_bars, which is a migration.
 */
export function withoutHad(drinks: DiscoverDrink[], totals: { drinks: number; bars: number } | null, had: readonly string[]) {
  if (!had.length) return { drinks, totals };
  const seen = new Set(had);
  const left = drinks.filter((d) => !seen.has(d.id));
  return { drinks: left, totals: totals && { drinks: Math.max(left.length, totals.drinks - (drinks.length - left.length)), bars: totals.bars } };
}

/** Bars whose name (or a word in it), neighbourhood or city starts with the search, name matches first. */
export function findBars(bars: readonly DiscoverBar[], search: string): DiscoverBar[] {
  const q = foldName(search);
  if (q.length < 2) return [];
  const score = (b: DiscoverBar) => {
    const name = foldName(b.name);
    if (name.startsWith(q)) return 0;
    if (name.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(q))) return 1;
    if ([b.locality, b.city].some((p) => p && foldName(p).startsWith(q))) return 2;
    return 3;
  };
  return bars
    .map((b) => ({ b, s: score(b) }))
    .filter((x) => x.s < 3)
    // Open bars before closed ones that match as well.
    .sort((x, y) => x.s - y.s || Number(x.b.closed) - Number(y.b.closed) || x.b.name.localeCompare(y.b.name))
    .map((x) => x.b);
}

function pinOf(b: DiscoverBar, drinks: number): MapPin | null {
  if (b.latitude === null || b.longitude === null) return null;
  return {
    id: b.id,
    handle: b.handle,
    name: b.name,
    logo: b.logo,
    brand: b.brand,
    place: [b.locality, b.city].filter(Boolean).join(', '),
    latitude: b.latitude,
    longitude: b.longitude,
    score: null,
    position: null,
    rankers: 0,
    drinks,
  };
}

/** One pin per open bar with matching drinks (its `drinks`), labelled with how many, most first; each bar once. */
export function barPins(bars: readonly DiscoverBar[]): MapPin[] {
  const seen = new Set<string>();
  const pins: MapPin[] = [];
  for (const b of bars) {
    if (b.closed || !b.drinks || seen.has(b.id)) continue;
    seen.add(b.id);
    const pin = pinOf(b, b.drinks);
    if (pin) pins.push(pin);
  }
  return pins.sort((a, b) => (b.drinks ?? 0) - (a.drinks ?? 0));
}

/** One pin per bar among these drinks, labelled with how many of them it pours. */
function drinkPins(drinks: readonly DiscoverDrink[], bars: ReadonlyMap<string, DiscoverBar>): MapPin[] {
  const counts = new Map<string, number>();
  for (const d of drinks) counts.set(d.barId, (counts.get(d.barId) ?? 0) + 1);
  return [...counts]
    .flatMap(([id, count]) => {
      const b = bars.get(id);
      const pin = b ? pinOf(b, count) : null;
      return pin ? [pin] : [];
    })
    .sort((a, b) => (b.drinks ?? 0) - (a.drinks ?? 0));
}

// --- "Best Martini": every martini, scored where people have ranked it ---

/**
 * The filter a "Best Martini" list is about, on top of Discover's: the ones
 * of that style when it leads a style (Martini: the Martinis style, so no
 * Espresso Martinis), else the ones that mention it.
 */
export function pickFilter(f: DrinkFilter, pickName: string): DrinkFilter {
  const style = STYLES.find((s) => s.classics[0] === pickName);
  // Just that style among the styles: "Martinis or Negronis" narrowed to the Martini's best.
  if (style) return { ...f, kinds: [...f.kinds.filter((k) => !STYLE_IDS.has(k)), style.id] };
  return { ...f, search: `${f.search} ${pickName}`.trim() };
}

export interface BarScore {
  score: number;
  /** 0 when the score is its best drink's, not the bar's own for the drink. */
  rankers: number;
}

/**
 * Each bar's score for the drink: its own (the ranked rows of
 * discover_drink_rankings), else its best-scored drink there. Bars with
 * neither have none.
 */
export function barScoresFor(drinks: readonly DiscoverDrink[], drinkScores: Readonly<Record<string, number>>, ranked: readonly DiscoverRow[]): Record<string, BarScore> {
  const out: Record<string, BarScore> = {};
  for (const d of drinks) {
    const s = drinkScores[d.id];
    if (s !== undefined && s > (out[d.barId]?.score ?? -1)) out[d.barId] = { score: s, rankers: 0 };
  }
  return Object.assign(out, venueScores(ranked));
}

/** Each ranked bar's own score (discover_top_bars rows), for "Bar 9.1" under a drink and the score on its pin. */
export function venueScores(ranked: readonly DiscoverRow[]): Record<string, BarScore> {
  const out: Record<string, BarScore> = {};
  for (const r of ranked) if (r.score !== null) out[r.venue_profile_id] = { score: r.score, rankers: r.rankers };
  return out;
}

/** Pins in Top bars' order (`order`: the viewer's loved bars, then the most relevant), from the area's early rows. */
export function withBarOrder(pins: readonly MapPin[], early: readonly DiscoverRow[]): MapPin[] {
  const order = new Map(early.map((r, i) => [r.venue_profile_id, i]));
  return pins.map((p) => (order.has(p.id) ? { ...p, order: order.get(p.id) } : p));
}

/** The drinks layer's pins with their bar's score, which the pin then shows (b02); bars without one stay dots. */
export function withBarScores(pins: readonly MapPin[], bars: Readonly<Record<string, BarScore>>): MapPin[] {
  return pins.map((p) => (bars[p.id] ? { ...p, score: bars[p.id].score, rankers: bars[p.id].rankers } : p));
}

/** Scored drinks first, best first; the rest stay in the order they came. */
export function byScore(drinks: readonly DiscoverDrink[], drinkScores: Readonly<Record<string, number>>): DiscoverDrink[] {
  return [...drinks].sort((a, b) => (drinkScores[b.id] ?? -1) - (drinkScores[a.id] ?? -1));
}

/** One pin per bar that pours the drink: its score when it has one, else just the bar. Scored bars first. */
export function scorePins(drinks: readonly DiscoverDrink[], bars: ReadonlyMap<string, DiscoverBar>, barScores: Readonly<Record<string, BarScore>>): MapPin[] {
  return drinkPins(drinks, bars)
    .map(({ drinks: count, ...pin }) => ({ ...pin, score: barScores[pin.id]?.score ?? null, rankers: barScores[pin.id]?.rankers ?? 0, matches: count }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/** Pins for closed bars, faded and labelled Closed. */
export function closedPins(bars: readonly DiscoverBar[]): MapPin[] {
  return bars.flatMap((b) =>
    b.latitude === null || b.longitude === null
      ? []
      : [{ id: b.id, handle: b.handle, name: b.name, logo: b.logo, brand: b.brand, place: [b.locality, b.city].filter(Boolean).join(', '), latitude: b.latitude, longitude: b.longitude, score: null, position: null, rankers: 0, closed: closedLabel(b.closedYear) }]
  );
}

/** "3 drinks", "1 drink". */
export function drinkCount(n: number): string {
  return `${n} ${n === 1 ? 'drink' : 'drinks'}`;
}

/** A bar row's drinks in search: "14 drinks on now" when some are on, else how many match ("3 drinks"), else nothing. */
export function barDrinksLine(bar: Pick<DiscoverBar, 'drinks' | 'onNow'>): string | null {
  if (bar.onNow) return `${drinkCount(bar.onNow)} on now`;
  return bar.drinks ? drinkCount(bar.drinks) : null;
}
