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
  place: string;
  latitude: number;
  longitude: number;
  /** Null for early bars (no score yet). */
  score: number | null;
  position: number | null;
  rankers: number;
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
      place: [r.locality, r.city].filter(Boolean).join(', '),
      latitude: r.latitude!,
      longitude: r.longitude!,
      score: r.is_early ? null : r.score,
      position: r.is_early ? null : r.position,
      rankers: r.rankers,
    }));
}

/** What's written on a pin: the score, or nothing while early. */
export function pinLabel(pin: MapPin): string {
  return pin.score === null ? '' : formatScore(pin.score);
}

/** How a pin looks on either map: the score in a pill (a dot while early), ink by default, the accent when selected. */
export function pinLook(pin: MapPin, selected: boolean, accent: { fill: string; text: string }) {
  const label = pinLabel(pin);
  return {
    label,
    minWidth: label ? 44 : 18,
    height: label ? 30 : 18,
    paddingHorizontal: label ? space.sm : 0,
    borderColor: backbar.dark.ink,
    backgroundColor: selected ? accent.fill : pin.score === null ? backbar.light.muted : backbar.light.ink,
    color: selected ? accent.text : backbar.dark.ink,
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
