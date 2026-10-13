/**
 * Discover's map: pins from ranked rows, fitting the camera to them, and
 * turning what the map shows into a "search this area" point. Pure; checked
 * by lib/discoverMap.check.ts. The map views are components/screens/home/DiscoverMap
 * (MapLibre on every platform: GL JS on web, MapLibre Native on iOS and Android).
 */
import type { CircleLayerSpecification, FilterSpecification, GeoJSONSourceSpecification } from 'maplibre-gl';

import { backbar, space, type DisplayFace } from '../constants/tokens';
import { withAlpha } from './color';
import { pinName } from './discoverMatch';
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
  /** Its venue's public accent and face, for its monogram; undefined when not known (BarMark looks it up). */
  brand?: { accent: string; face: DisplayFace } | null;
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
  /** While searching: its best matching drink, written on the pin in place of the count (lib/discoverMatch.ts namePins). */
  top?: string;
  /** While searching: an unnamed pin says how many of its drinks match (disc-search-pin), unless it has a score. */
  showCount?: boolean;
  /** While searching: its best match's picture, shown in place of the logo. */
  image?: string | null;
  /** While searching: its best match only mentions the word, so the pin is faded. */
  weak?: boolean;
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

/**
 * What's written on a pin: the bar's score (b02); while searching, how many
 * of its drinks match; else nothing (a plain dot or its logo).
 */
export function pinLabel(pin: MapPin): string {
  if (pin.closed) return 'Closed';
  if (pin.score !== null) return formatScore(pin.score);
  return pin.showCount && pin.drinks ? String(pin.drinks) : '';
}

/**
 * Every bar as GeoJSON for the map's own layers: a plain dot each (Kevin's
 * option C, 13 Oct), gathered into areas when zoomed out (option D). The
 * score (-1 for none) feeds an area's best; closed bars are faded dots.
 */
export function dotsOf(pins: readonly MapPin[]): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; score: number; closed: boolean }> {
  return {
    type: 'FeatureCollection',
    features: pins.map((p) => ({
      type: 'Feature',
      properties: { id: p.id, score: p.closed || p.score === null ? -1 : p.score, closed: !!p.closed },
      geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
    })),
  };
}

/**
 * Below this zoom (a city or wider) the map shows areas, one label each
 * with its best score and bar count; from it in, the best bars in view are
 * score pins and the rest dots. MapLibre clusters up to AREA_ZOOM - 1.
 */
export const AREA_ZOOM = 12;
/** Score pins on screen up close: about 8 to 12 of the best in view, so more come in as you zoom. */
export const BEST_PINS = 10;
/** Area labels drawn as views at most; clusters keep the count low, this is the guard. */
export const MAX_AREAS = 40;
/** How the map's clusters are made, the same on web and native. */
export const AREA_CLUSTER = {
  cluster: true,
  clusterMaxZoom: AREA_ZOOM - 1,
  clusterRadius: 80,
  clusterProperties: { best: ['max', ['get', 'score']] },
} satisfies Pick<GeoJSONSourceSpecification, 'cluster' | 'clusterMaxZoom' | 'clusterRadius' | 'clusterProperties'>;

/** What part of the map is on screen: [west, south, east, north] and the zoom. */
export interface MapView {
  bounds: readonly [number, number, number, number];
  zoom: number;
}

function inView([west, south, east, north]: MapView['bounds'], p: Pick<MapPin, 'latitude' | 'longitude'>): boolean {
  if (p.latitude < south || p.latitude > north) return false;
  // Across the antimeridian west is greater than east.
  return west <= east ? p.longitude >= west && p.longitude <= east : p.longitude >= west || p.longitude <= east;
}

/**
 * Which bars the map draws as pins (views), best first; every other bar is
 * a dot in the map's own layer. Up close, the BEST_PINS best scored bars in
 * view; zoomed out (areas), none. Always the selected bar and, while
 * searching, the bars whose pins name a drink (namePins). Before the map
 * reports what it shows, the best scored bars anywhere.
 */
export function pinsToDraw(pins: readonly MapPin[], view: MapView | null, selectedId: string | null): MapPin[] {
  const always = pins.filter((p) => p.id === selectedId || p.top);
  if (view && view.zoom < AREA_ZOOM) return always;
  const best = pins
    .filter((p) => p.score !== null && !p.closed && (!view || inView(view.bounds, p)))
    .sort((a, b) => b.score! - a.score!)
    .slice(0, BEST_PINS);
  return [...always, ...best.filter((p) => !always.includes(p))];
}

/** An area's label: "9.1 · 24 bars", or just the count when none has a score yet. */
export function areaLabel(best: number | null, count: number): string {
  const bars = `${count} ${count === 1 ? 'bar' : 'bars'}`;
  return best !== null && best >= 0 ? `${formatScore(best)} · ${bars}` : bars;
}

/** A map area: one of MapLibre's clusters, as both maps read them back. */
export interface MapArea {
  id: number;
  latitude: number;
  longitude: number;
  label: string;
}

/**
 * Areas from the cluster features in a map's loaded tiles (querySourceFeatures
 * on web, GeoJSONSource getData on native): the ones in view, each once (a
 * tile edge can repeat one), none up close, capped at MAX_AREAS.
 */
export function areasFrom(features: readonly GeoJSON.Feature[], view: MapView | null): MapArea[] {
  const seen = new Map<number, MapArea>();
  if (view && view.zoom >= AREA_ZOOM) return [];
  for (const f of features) {
    const props = f.properties ?? {};
    if (f.geometry.type !== 'Point' || typeof props.cluster_id !== 'number' || seen.has(props.cluster_id)) continue;
    const [longitude, latitude] = f.geometry.coordinates;
    if (view && !inView(view.bounds, { latitude, longitude })) continue;
    seen.set(props.cluster_id, { id: props.cluster_id, latitude, longitude, label: areaLabel(typeof props.best === 'number' ? props.best : null, Number(props.point_count) || 0) });
    if (seen.size >= MAX_AREAS) break;
  }
  return [...seen.values()];
}

/** The dots layer's filter: single bars (not areas), less the ones `drawn` as pins. */
export function dotsFilter(drawn: readonly string[]): FilterSpecification {
  return ['all', ['!', ['has', 'point_count']], ['!', ['in', ['get', 'id'], ['literal', [...drawn]]]]];
}

/** The dots' paint on either map (disc-map-opt-c): a small dark dot with a soft ring, closed bars faded. */
export const DOT_PAINT: CircleLayerSpecification['paint'] = {
  'circle-color': backbar.dark.raised,
  'circle-radius': 5,
  'circle-stroke-width': 2,
  'circle-stroke-color': withAlpha(backbar.dark.ink, 0.5),
  'circle-opacity': ['case', ['get', 'closed'], 0.5, 1],
  'circle-stroke-opacity': ['case', ['get', 'closed'], 0.5, 1],
};

/** How an area label looks on either map (disc-map-opt-d): the score pin's dark pill, a little taller. */
export const areaLook = {
  height: 36,
  paddingHorizontal: space.md,
  backgroundColor: backbar.dark.raised,
  borderColor: withAlpha(backbar.dark.ink, 0.25),
  color: backbar.dark.ink,
  boxShadow: `0 4px 12px ${withAlpha(backbar.dark.ground, 0.45)}`,
} as const;

/** What a screen reader says for a pin. */
export function pinDescription(pin: MapPin): string {
  if (pin.closed) return `${pin.name}, ${pin.closed.toLowerCase()}`;
  const count = pin.drinks ?? (pin.score === null ? pin.matches : undefined);
  const score = pin.score === null ? null : `score ${formatScore(pin.score)}`;
  if (count) return [`${pin.name}, ${count} ${count === 1 ? 'drink' : 'drinks'}${pin.top ? `: ${pin.top}` : ''}`, score].filter(Boolean).join(', ');
  return score ? `${pin.name}, ${score}` : `${pin.name}, early`;
}

/**
 * How a pin looks on either map (disc-map, disc-map-opt-c): the score in mono
 * on a dark pill with a soft ring and shadow, or a dot while early; while
 * searching, its best match's picture too. The accent when selected. A closed
 * bar is muted and faded, so it reads as history, not a plan.
 */
export function pinLook(pin: MapPin, selected: boolean, accent: { fill: string; text: string }) {
  const label = pin.top ? pinName(pin.top, pin.drinks ?? 1) : pinLabel(pin);
  const logoSize = 26;
  // A lone logo needs room for its 2px ring.
  const height = label ? 30 : pin.image ? logoSize + 4 : 18;
  return {
    label,
    logo: pin.image ?? null,
    logoSize,
    minWidth: label ? 44 : height,
    height,
    paddingLeft: label ? (pin.image ? 2 : space.sm + 2) : 0,
    paddingRight: label ? space.sm + 2 : 0,
    gap: space.xs,
    borderWidth: selected ? 2 : 1,
    borderColor: selected ? accent.fill : withAlpha(backbar.dark.ink, 0.2),
    backgroundColor: selected ? accent.fill : pin.score === null && !pin.drinks && !pin.matches ? backbar.light.muted : backbar.dark.raised,
    boxShadow: `0 4px 12px ${withAlpha(backbar.dark.ground, 0.45)}`,
    color: selected ? accent.text : backbar.dark.ink,
    opacity: (pin.closed || pin.weak) && !selected ? (pin.weak ? 0.55 : 0.6) : 1,
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
  /** Web-mercator zoom, as Camera has it. */
  zoom: number;
}

export interface Camera {
  latitude: number;
  longitude: number;
  /** Web-mercator zoom, as MapLibre, Apple and Google maps take it. */
  zoom: number;
}

/** A viewport from a map's centre and its [west, south, east, north] bounds, as MapLibre reports them. */
export function viewportFrom(center: { lat: number; lng: number }, [west, south, east, north]: readonly [number, number, number, number], zoom: number): Viewport {
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: north - south, longitudeDelta: east - west, zoom };
}

/**
 * Whether the map has moved far enough from where its results are for (the
 * last search, or the camera that fit them) to search again: half a zoom
 * step, or a sixth of the view across. Smaller nudges keep the list as it is.
 * No `from` (nothing fit yet) counts any move.
 */
export function movedFrom(from: Camera | null, v: Viewport): boolean {
  if (!from) return true;
  if (Math.abs(v.zoom - from.zoom) >= 0.5) return true;
  // Across the antimeridian, 179 to -179 is two degrees, not 358.
  const dLng = ((v.longitude - from.longitude + 540) % 360) - 180;
  return Math.abs(v.latitude - from.latitude) > Math.abs(v.latitudeDelta) / 6 || Math.abs(dLng) > Math.abs(v.longitudeDelta) / 6;
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

/**
 * Near me opens on the person's own neighbourhood (about 2 km across a
 * phone), not the whole 10 km the list covers; they zoom out for more.
 */
const NEAR_ME_ZOOM = 13.5;

/** A camera for an area: near me, the person's neighbourhood; a map area, its whole circle; null for a city or anywhere. */
export function cameraForArea(area: Area): Camera | null {
  if (area.kind !== 'point') return null;
  if (area.source === 'me') return { latitude: area.latitude, longitude: area.longitude, zoom: NEAR_ME_ZOOM };
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
