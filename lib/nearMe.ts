/**
 * Discover's "where": near a point (me, or a map area), in a city, or
 * anywhere; how far away a bar is; ranked versus early rows; and turning an
 * address search result (Photon, from OpenStreetMap) into a bar to add.
 * Queries are in hooks/useDiscover.ts; checked by lib/nearMe.check.ts.
 */

/** Kilometres around "near me" when nothing else says. */
export const NEAR_ME_KM = 10;

export type Area =
  | { kind: 'anywhere' }
  | { kind: 'city'; city: string; country_code: string; label: string }
  | { kind: 'point'; latitude: number; longitude: number; radiusKm: number; source: 'me' | 'map' };

/** "near you", "in this area", "in New York", "anywhere". */
export function areaLabel(area: Area): string {
  if (area.kind === 'point') return area.source === 'me' ? 'near you' : 'in this area';
  if (area.kind === 'city') return `in ${area.label}`;
  return 'anywhere';
}

/**
 * ~110 m. Coordinates are rounded before they leave the device: enough for
 * a 10 km search, and nothing finer about where someone is standing.
 */
export function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * ~1.1 km. "Near me" snaps to this grid: a 10 km search barely moves, small
 * steps keep the same query (and its cache), and it is what the device keeps
 * as the last place (store/useLastPlace.ts).
 */
export function snapNearMe(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The near-me area around a position, snapped (snapNearMe). */
export function nearMeArea(at: { latitude: number; longitude: number }): Extract<Area, { kind: 'point' }> {
  return { kind: 'point', latitude: snapNearMe(at.latitude), longitude: snapNearMe(at.longitude), radiusKm: NEAR_ME_KM, source: 'me' };
}

/** The area arguments for discover_drink_rankings and discover_top_bars. */
export function areaParams(area: Area): Record<string, string | number> {
  if (area.kind === 'point') {
    return { p_latitude: roundCoord(area.latitude), p_longitude: roundCoord(area.longitude), p_radius_km: area.radiusKm };
  }
  if (area.kind === 'city') return { p_city: area.city, p_country_code: area.country_code };
  return {};
}

/** "350 m", "1.2 km", "14 km"; or in miles ("0.2 mi", "9 mi") where people use them. */
export function formatDistance(km: number, imperial = false): string {
  if (imperial) {
    const mi = Math.max(km / 1.609344, 0.1);
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  if (km < 1) return `${Math.max(Math.round((km * 1000) / 50) * 50, 50)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Miles for US and UK habits. Browsers don't say, so the region decides there. */
export function usesMiles(locale: { measurementSystem?: string | null; regionCode?: string | null } | undefined): boolean {
  if (locale?.measurementSystem) return locale.measurementSystem === 'us' || locale.measurementSystem === 'uk';
  return ['US', 'GB', 'LR', 'MM'].includes(locale?.regionCode ?? '');
}

/** Rows from the discover RPCs: ranked ones carry a score and position, early ones don't. */
export interface DiscoverRow {
  position: number | null;
  venue_profile_id: string;
  handle: string;
  display_name: string;
  locality: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  score: number | null;
  rankers: number;
  is_early: boolean;
  /** discover_top_bars only: drinks ranked there. */
  drinks?: number;
  /** The bar's logo (its profile avatar), added by hooks/useDiscover. */
  avatar_url?: string | null;
}

export interface RankedRow extends DiscoverRow {
  position: number;
  score: number;
}

/** Ranked rows (best first) and early rows (most rankers first), as the RPC ordered them. */
export function splitEarly(rows: readonly DiscoverRow[]): { ranked: RankedRow[]; early: DiscoverRow[] } {
  const ranked: RankedRow[] = [];
  const early: DiscoverRow[] = [];
  for (const r of rows) {
    if (!r.is_early && r.position !== null && r.score !== null) ranked.push(r as RankedRow);
    else early.push(r);
  }
  return { ranked, early };
}

/** "3 people" in early copy. */
export function peopleCount(n: number): string {
  return n === 1 ? '1 person' : `${n} people`;
}

/** "3 people ranked", or "Not ranked yet" for a bar on Cocktail nobody has ranked. */
export function rankedCount(n: number): string {
  return n ? `${peopleCount(n)} ranked` : 'Not ranked yet';
}

/** The note over early bars: some people ranking them, or nobody yet. */
export function earlyNote(early: readonly DiscoverRow[], minRankers: number): string {
  return early.some((r) => r.rankers > 0)
    ? `Nothing here has ${minRankers} rankers yet, so there are no scores. The bars people have started ranking come first.`
    : `Nobody has ranked a drink at these bars yet. A bar gets a score once ${minRankers} people rank drinks there.`;
}

// --- Adding a bar from an address search ---

/** Photon asks for at most about one request a second per user, so: */
export const ADDRESS_MIN_CHARS = 3;
export const ADDRESS_DEBOUNCE_MS = 450;

export function photonUrl(query: string, limit = 6): string {
  return `https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=${limit}`;
}

/** The parts of a Photon (GeoJSON) feature we use. */
export interface PhotonFeature {
  geometry?: { type?: string; coordinates?: number[] } | null;
  properties?: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    /** "house", "street", "city"… */
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  } | null;
}

/** A place to add as a bar: what add_venue needs. */
export interface VenueAddress {
  key: string;
  /** Set when the result is a named place (a bar, a restaurant), to prefill the bar's name. */
  placeName: string | null;
  address_line: string;
  locality: string | null;
  postcode: string | null;
  city: string;
  region: string | null;
  country_code: string;
  latitude: number;
  longitude: number;
  /** One line for the list: "Dead Rabbit, 30 Water Street, New York". */
  label: string;
}

const PLACE_KEYS = new Set(['amenity', 'shop', 'tourism', 'leisure', 'building']);

/**
 * A search result as a bar address, or null when it can't be one: no street,
 * no city or no country (a whole city, a road with no town). Street numbers
 * go first or last by country, as people write them.
 */
export function venueAddressFrom(feature: PhotonFeature): VenueAddress | null {
  const p = feature.properties ?? {};
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const country = (p.countrycode ?? '').toUpperCase();
  const city = (p.city ?? p.county ?? '').trim();
  // A street result names the street in `name`, not `street`.
  const street = (p.street ?? (p.type === 'street' ? p.name : '') ?? '').trim();
  if (!/^[A-Z]{2}$/.test(country) || !city || !street) return null;
  const numberLast = ['DE', 'AT', 'CH', 'NL', 'BE', 'IT', 'ES', 'PT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'BR', 'AR', 'MX'].includes(country);
  const house = (p.housenumber ?? '').trim();
  const address_line = house ? (numberLast ? `${street} ${house}` : `${house} ${street}`) : street;
  const placeName = p.name && PLACE_KEYS.has(p.osm_key ?? '') && p.name.trim() !== street ? p.name.trim() : null;
  const locality = (p.district ?? p.locality ?? '').trim() || null;
  return {
    key: `${p.osm_type ?? ''}${p.osm_id ?? `${lat},${lng}`}`,
    placeName,
    address_line,
    locality,
    postcode: p.postcode?.trim() || null,
    city,
    region: p.state?.trim() || null,
    country_code: country,
    latitude: lat,
    longitude: lng,
    label: [placeName, address_line, locality && locality !== city ? locality : null, city].filter(Boolean).join(', '),
  };
}

/** Usable addresses from a Photon response, one per place. */
export function venueAddressesFrom(response: { features?: PhotonFeature[] } | null | undefined): VenueAddress[] {
  const seen = new Set<string>();
  const out: VenueAddress[] = [];
  for (const f of response?.features ?? []) {
    const a = venueAddressFrom(f);
    if (!a || seen.has(a.key)) continue;
    seen.add(a.key);
    out.push(a);
  }
  return out;
}
