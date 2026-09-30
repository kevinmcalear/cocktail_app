/**
 * Discover's drinks at bars: searching them (and the bars) by name, style,
 * spirit or ingredient, keeping those in an area, and turning them into map
 * pins. Pure; checked by lib/discoverDrinks.check.ts. The data comes from
 * hooks/useDiscoverDrinks.ts.
 */
import { foldName } from './discover';
import type { MapPin } from './discoverMap';
import { spiritsOf, stylesOf } from './drinkStyles';
import type { Area } from './nearMe';

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
}

export interface DiscoverDrink {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  barId: string;
  ingredients: string[];
  styles: string[];
  spirits: string[];
  /** Folded name, description and ingredients, for search. */
  haystack: string;
}

export function toDiscoverDrink(d: Omit<DiscoverDrink, 'styles' | 'spirits' | 'haystack'> & { riffOf: string | null }): DiscoverDrink {
  const { riffOf, ...drink } = d;
  const facts = { name: d.name, description: d.description, riffOf, ingredients: d.ingredients };
  return {
    ...drink,
    styles: stylesOf(facts),
    spirits: spiritsOf(facts),
    haystack: foldName([d.name, riffOf, d.description, ...d.ingredients].filter(Boolean).join(' | ')),
  };
}

const KM_PER_DEG = 111.045;

/** Great-circle distance in km. */
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
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
  /** A style or spirit id (drinkStyles), or null for every drink. */
  kind: string | null;
  /** Typed search: every word must match the drink's name, description, ingredients or bar. */
  search: string;
  area: Area;
}

/**
 * The drinks that match, best first: name matches before description ones,
 * then drinks with a picture, then A to Z with letters before symbols.
 */
export function filterDrinks(drinks: readonly DiscoverDrink[], bars: ReadonlyMap<string, DiscoverBar>, f: DrinkFilter): DiscoverDrink[] {
  const words = foldName(f.search).split(' ').filter(Boolean);
  const hits = drinks.filter((d) => {
    const bar = bars.get(d.barId);
    if (!bar || !barInArea(bar, f.area)) return false;
    if (f.kind && !d.styles.includes(f.kind) && !d.spirits.includes(f.kind)) return false;
    if (!words.length) return true;
    const text = `${d.haystack} | ${foldName(bar.name)}`;
    return words.every((w) => text.includes(w));
  });
  const q = words.join(' ');
  // Name matches, then pictures, then names that start with a letter ("&thesea" and "1986" last).
  const rank = (d: DiscoverDrink) => (q && foldName(d.name).includes(q) ? 0 : 4) + (d.imageUrl ? 0 : 2) + (/^\p{L}/u.test(d.name) ? 0 : 1);
  return hits.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
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
    .sort((x, y) => x.s - y.s || x.b.name.localeCompare(y.b.name))
    .map((x) => x.b);
}

/** One pin per bar that has matching drinks, labelled with how many. */
export function drinkPins(drinks: readonly DiscoverDrink[], bars: ReadonlyMap<string, DiscoverBar>): MapPin[] {
  const counts = new Map<string, number>();
  for (const d of drinks) counts.set(d.barId, (counts.get(d.barId) ?? 0) + 1);
  const pins: MapPin[] = [];
  for (const [id, count] of counts) {
    const b = bars.get(id);
    if (!b || b.latitude === null || b.longitude === null) continue;
    pins.push({
      id: b.id,
      handle: b.handle,
      name: b.name,
      logo: b.logo,
      place: [b.locality, b.city].filter(Boolean).join(', '),
      latitude: b.latitude,
      longitude: b.longitude,
      score: null,
      position: null,
      rankers: 0,
      drinks: count,
    });
  }
  return pins.sort((a, b) => (b.drinks ?? 0) - (a.drinks ?? 0));
}

/** "3 drinks", "1 drink". */
export function drinkCount(n: number): string {
  return `${n} ${n === 1 ? 'drink' : 'drinks'}`;
}
