/**
 * Discover's map: pins from ranked rows, fitting the camera to them, and
 * turning what the map shows into a "search this area" point. Pure; checked
 * by lib/discoverMap.check.ts. The map views are components/screens/home/DiscoverMap
 * (MapLibre on every platform: GL JS on web, MapLibre Native on iOS and Android).
 */
import { backbar, space } from '../constants/tokens';
import { formatScore } from './ranking';
import { roundCoord, type Area, type DiscoverRow } from './nearMe';

/**
 * OpenFreeMap: free, no key, OpenStreetMap data. Muted base maps so the pins
 * and the drink photos carry the colour, in both schemes. Web and native load
 * the same style, so the maps look the same everywhere.
 */
export const MAP_STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

export interface MapPin {
  id: string;
  /** For the /p/<handle> link. */
  handle: string;
  name: string;
  /** The bar's logo, when it has one. */
  logo: string | null;
  place: string;
  latitude: number;
  longitude: number;
  /** Null for early bars (no score yet). */
  score: number | null;
  position: number | null;
  rankers: number;
  /** On the drinks layer: how many of the bar's drinks match. */
  drinks?: number;
  /** On a "Best Martini" layer: how many of the bar's drinks are martinis (not on the pin, which shows the score). */
  matches?: number;
  /** A closed bar: "Closed 2019". */
  closed?: string;
}

/** Pins for the rows that have coordinates: ranked first, then early. */
export function pinsFrom(rows: { ranked: DiscoverRow[]; early: DiscoverRow[] } | undefined): MapPin[] {
  if (!rows) return [];
  return [...rows.ranked, ...rows.early]
    .filter((r) => r.latitude !== null && r.longitude !== null)
    .map((r) => ({
      id: r.venue_profile_id,
      handle: r.handle,
      name: r.display_name,
      logo: r.avatar_url ?? null,
      place: [r.locality, r.city].filter(Boolean).join(', '),
      latitude: r.latitude!,
      longitude: r.longitude!,
      score: r.is_early ? null : r.score,
      position: r.is_early ? null : r.position,
      rankers: r.rankers,
    }));
}

/** What's written on a pin: how many drinks match, the score, or nothing while early. */
export function pinLabel(pin: MapPin): string {
  if (pin.closed) return 'Closed';
  if (pin.drinks) return String(pin.drinks);
  return pin.score === null ? '' : formatScore(pin.score);
}

/** What a screen reader says for a pin. */
export function pinDescription(pin: MapPin): string {
  if (pin.closed) return `${pin.name}, ${pin.closed.toLowerCase()}`;
  const count = pin.drinks ?? (pin.score === null ? pin.matches : undefined);
  if (count) return `${pin.name}, ${count} ${count === 1 ? 'drink' : 'drinks'}`;
  return pin.score === null ? `${pin.name}, early` : `${pin.name}, score ${formatScore(pin.score)}`;
}

/**
 * How a pin looks on either map: the bar's logo (when it has one) and its
 * score in a pill, or a dot while early. Ink by default, the accent when
 * selected. A closed bar is muted and faded, so it reads as history, not a plan.
 */
export function pinLook(pin: MapPin, selected: boolean, accent: { fill: string; text: string }) {
  const label = pinLabel(pin);
  const logoSize = 26;
  // A lone logo needs room for its 2px ring.
  const height = label ? 30 : pin.logo ? logoSize + 4 : 18;
  return {
    label,
    logo: pin.logo,
    logoSize,
    minWidth: label ? 44 : height,
    height,
    paddingLeft: label ? (pin.logo ? 2 : space.sm) : 0,
    paddingRight: label ? space.sm : 0,
    gap: space.xs,
    borderColor: selected ? accent.fill : backbar.dark.ink,
    backgroundColor: selected ? accent.fill : pin.score === null && !pin.drinks && !pin.matches ? backbar.light.muted : backbar.light.ink,
    color: selected ? accent.text : backbar.dark.ink,
    opacity: pin.closed && !selected ? 0.6 : 1,
    // Where pins overlap: the selected one, then scored bars (higher over lower), over plain and closed ones.
    zIndex: selected ? 300 : pin.closed ? 0 : pin.score !== null ? 100 + Math.round(pin.score * 10) : 1,
  };
}

/** What the map is showing: its centre and how many degrees it spans. */
export interface Viewport {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface Camera {
  latitude: number;
  longitude: number;
  /** Web-mercator zoom, as MapLibre, Apple and Google maps take it. */
  zoom: number;
}

/** A viewport from a map's centre and its [west, south, east, north] bounds, as MapLibre reports them. */
export function viewportFrom(center: { lat: number; lng: number }, [west, south, east, north]: readonly [number, number, number, number]): Viewport {
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: north - south, longitudeDelta: east - west };
}

const KM_PER_DEG = 111.045;

/** A camera that shows every pin with some room around it; a sensible city view for one pin; null for none. */
export function cameraFor(pins: readonly Pick<MapPin, 'latitude' | 'longitude'>[]): Camera | null {
  if (!pins.length) return null;
  const lats = pins.map((p) => p.latitude);
  const lngs = pins.map((p) => p.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  // Longitude degrees shrink towards the poles; latitude spans read taller on a phone.
  const span = Math.max((maxLng - minLng) * Math.cos((latitude * Math.PI) / 180), (maxLat - minLat) * 1.6, 0.01);
  const zoom = Math.min(Math.max(Math.log2(360 / span) - 1.2, 2), 15);
  return { latitude, longitude, zoom: Math.round(zoom * 10) / 10 };
}

/** A camera that shows a point area's whole circle; null for a city or anywhere. */
export function cameraForArea(area: Area): Camera | null {
  if (area.kind !== 'point') return null;
  const dLat = area.radiusKm / KM_PER_DEG;
  return cameraFor([
    { latitude: area.latitude - dLat, longitude: area.longitude },
    { latitude: area.latitude + dLat, longitude: area.longitude },
  ]);
}

/**
 * "Search this area": the circle that covers what the map shows (half its
 * diagonal), as a Discover area. Kept between 0.5 and 200 km, as the RPCs do.
 */
export function areaFromViewport(v: Viewport): Extract<Area, { kind: 'point' }> {
  const halfLatKm = (Math.abs(v.latitudeDelta) * KM_PER_DEG) / 2;
  const halfLngKm = (Math.abs(v.longitudeDelta) * KM_PER_DEG * Math.cos((v.latitude * Math.PI) / 180)) / 2;
  const radiusKm = Math.min(Math.max(Math.hypot(halfLatKm, halfLngKm), 0.5), 200);
  return { kind: 'point', latitude: roundCoord(v.latitude), longitude: roundCoord(v.longitude), radiusKm: Math.round(radiusKm * 10) / 10, source: 'map' };
}
