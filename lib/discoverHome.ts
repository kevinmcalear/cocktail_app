/**
 * Discover as drawn (Prod-discover, Prod-desk-discover, Prod-and-dark,
 * Sta-discover): the place in the eyebrow, which bars are open, the ranked
 * "Best Martinis near you" rows and New menus. Pure; checked by
 * lib/discoverHome.check.ts. The data comes from hooks/useDiscoverHome.ts.
 */
import { barClock, hoursStatus, WEEK_DAYS, type WeekHours } from './barHours';
import type { DiscoverDrink } from './discoverDrinks';
import type { MenuEdition } from './menuEditions';
import type { Area, DiscoverRow } from './nearMe';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The eyebrow's place: "West Village" near you (the neighbourhood most of the
 * nearest bars are in), the city picked, or Anywhere.
 */
export function placeName(area: Area, bars: readonly { locality: string | null; city: string | null }[]): string {
  if (area.kind === 'city') return area.label;
  if (area.kind === 'anywhere') return 'Anywhere';
  const counts = new Map<string, number>();
  for (const b of bars.slice(0, 20)) {
    const name = b.locality || b.city;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [name, n] of counts) if (!best || n > counts.get(best)!) best = name;
  return best ?? (area.source === 'me' ? 'Near you' : 'This area');
}

/** Open now (true), shut now (false), or nobody knows (null). */
export function openNow(hours: WeekHours | null | undefined, now: Date, timeZone?: string | null): boolean | null {
  return hoursStatus(hours, now, timeZone)?.open ?? null;
}

/** Desktop's Late chip: tonight's hours run past midnight. Unknown hours aren't late. */
export function closesLate(hours: WeekHours | null | undefined, now: Date, timeZone?: string | null): boolean {
  if (!hours) return false;
  // ponytail: "tonight" is the bar's calendar day, so just after midnight it reads the new day's hours. Upgrade: the service day (lib/serviceDay).
  const today = hours[WEEK_DAYS[barClock(now, timeZone).day]] ?? [];
  return today.some(([open, close]) => close <= open);
}

export interface BestRow {
  position: number;
  barId: string;
  barHandle: string;
  barName: string;
  /** The bar's drink ranked as the classic, when Discover found it; else the classic's name and no drink. */
  name: string;
  drinkId: string | null;
  score: number;
  rankers: number;
  distanceKm: number | null;
}

/**
 * The ranked rows: each bar's place for the classic (discover_drink_rankings),
 * named after the bar's own drink of it ("House Martini") when the area's
 * drinks have one, else the classic ("Martini").
 */
export function bestRows(ranked: readonly DiscoverRow[], drinks: readonly DiscoverDrink[], classic: string): BestRow[] {
  const first = new Map<string, DiscoverDrink>();
  for (const d of drinks) if (!first.has(d.barId)) first.set(d.barId, d);
  return ranked
    .filter((r) => r.position !== null && r.score !== null)
    .map((r) => {
      const drink = first.get(r.venue_profile_id);
      return {
        position: r.position!,
        barId: r.venue_profile_id,
        barHandle: r.handle,
        barName: r.display_name,
        name: drink?.name ?? classic,
        drinkId: drink?.id ?? null,
        score: r.score!,
        rankers: r.rankers,
        distanceKm: r.distance_km,
      };
    });
}

export interface OnMenuRow {
  barId: string;
  barHandle: string;
  barName: string;
  /** The bar's neighbourhood or city, for the row's second line. */
  place: string | null;
  name: string;
  drinkId: string;
  /** Metres from the person, when the list was asked from where they are. */
  distanceM: number | null;
}

/**
 * Before a bar has enough rankers to be ranked: the style's drinks on a menu
 * now (the list is asked for on-now drinks), one a bar (its first, in the
 * list's order), so Discover still shows drinks. Kevin, 12 Nov 2026: "drinks on menus nearby" until rankings exist.
 */
export function onMenuRows(drinks: readonly DiscoverDrink[], fromMe = true): OnMenuRow[] {
  const seen = new Set<string>();
  const rows: OnMenuRow[] = [];
  for (const d of drinks) {
    if (seen.has(d.barId)) continue;
    seen.add(d.barId);
    rows.push({ barId: d.barId, barHandle: d.bar.handle, barName: d.bar.name, place: d.bar.locality ?? d.bar.city, name: d.name, drinkId: d.id, distanceM: fromMe ? d.distance : null });
  }
  return rows;
}

export interface NewMenu {
  id: string;
  name: string;
  barId: string;
  barName: string;
  /** Its first drink, for the tile's drawing. */
  drinkId: string | null;
  /** "Little Rye · Nov" when it went on this month, else the bar. */
  sub: string;
}

/** What a New menus tile reads of a menu. */
export type NewMenuSource = Pick<MenuEdition, 'id' | 'name' | 'year' | 'month' | 'is_current' | 'drinks'>;

/**
 * New menus: the menus on now at the nearby bars, newest first. Menus are
 * known to the month, so a tile says the month it went on only when that's
 * this month.
 */
export function newMenus(bars: readonly { barId: string; barName: string; editions: readonly NewMenuSource[] }[], now: Date, limit = 6): NewMenu[] {
  const on = bars.flatMap((b) => b.editions.filter((e) => e.is_current).map((e) => ({ e, b })));
  on.sort((x, y) => y.e.year - x.e.year || (y.e.month ?? 0) - (x.e.month ?? 0) || x.e.name.localeCompare(y.e.name));
  const thisMonth = (e: NewMenuSource) => e.year === now.getFullYear() && e.month === now.getMonth() + 1;
  return on.slice(0, limit).map(({ e, b }) => ({
    id: e.id,
    name: e.name,
    barId: b.barId,
    barName: b.barName,
    drinkId: e.drinks[0]?.id ?? null,
    sub: thisMonth(e) ? `${b.barName} · ${MONTHS[e.month! - 1]}` : b.barName,
  }));
}

/** The map card's caption: "12 bars open near you", or how many bars when nobody's hours are known. */
export function mapCaption(open: number, bars: number, area: Area): string {
  const where = area.kind === 'point' ? (area.source === 'me' ? 'near you' : 'here') : area.kind === 'city' ? `in ${area.label}` : 'anywhere';
  if (open) return `${open} ${open === 1 ? 'bar' : 'bars'} open ${where}`;
  return `${bars} ${bars === 1 ? 'bar' : 'bars'} ${where}`;
}
