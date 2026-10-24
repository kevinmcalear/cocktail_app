/**
 * Discover's map: pins from ranked rows, fitting the camera to them, and
 * turning what the map shows into a "search this area" point. Pure; checked
 * by lib/discoverMap.check.ts. The map views are components/screens/home/DiscoverMap
 * (MapLibre on every platform: GL JS on web, MapLibre Native on iOS and Android).
 */
import type { CircleLayerSpecification, FilterSpecification, GeoJSONSourceSpecification, StyleSpecification } from 'maplibre-gl';

import { backbar, fontFamilies, space, type, type DisplayFace } from '../constants/tokens';
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

/** The dark style's street and place names: 37% grey at 10 px read as nothing on a phone (Eddie, 14 Oct). */
const DARK_LABELS = new Set(['highway_name_other', 'highway_name_motorway', 'place_other', 'place_suburb', 'place_village', 'place_town']);

/**
 * A map style with street and area names you can read: on the dark map, the
 * muted ink on a ground-coloured halo, a size up from street level. The light
 * map's are already dark grey at 12 px, so it's left as it is. Pure, so web
 * (setStyle's transformStyle) and native (useMapStyle) patch it the same way.
 */
export function readableLabels(style: StyleSpecification, scheme: keyof typeof MAP_STYLE): StyleSpecification {
  if (scheme !== 'dark') return style;
  const c = backbar.dark;
  return {
    ...style,
    layers: style.layers.map((layer) =>
      layer.type === 'symbol' && DARK_LABELS.has(layer.id)
        ? {
            ...layer,
            layout: { ...layer.layout, 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 16, 12, 18, 13] },
            paint: { ...layer.paint, 'text-color': c.muted, 'text-halo-color': c.ground, 'text-halo-width': 1.5, 'text-halo-blur': 0 },
          }
        : layer,
    ),
  };
}

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
  /** Where an unscored bar sits on Top bars here (the viewer's loved bars, then the most relevant; discover_top_bars), 0 first. */
  order?: number;
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
    .map((r, i) => ({
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
      order: r.is_early ? i : undefined,
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
  const open = pins.filter((p) => !p.closed && (!view || inView(view.bounds, p)));
  const best = open.filter((p) => p.score !== null).sort((a, b) => b.score! - a.score!).slice(0, BEST_PINS);
  // A score needs MIN_RANKERS people, and most bars have none yet (prod, 13 Oct: none at all), which left
  // the map all dots. Until then the bars in view with a logo fill the rest, the logo in the score's place:
  // in Top bars' order (loved, then most relevant), then the busiest.
  const known = open
    .filter((p) => p.score === null && p.logo)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (b.drinks ?? b.matches ?? 0) - (a.drinks ?? a.matches ?? 0))
    .slice(0, BEST_PINS - best.length);
  return [...always, ...[...best, ...known].filter((p) => !always.includes(p))];
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
 * From street level in, each bar's pin writes its name beside a bigger logo,
 * as a searched pin writes its drink's (Eddie, 14 Oct: logos were hard to
 * read and you couldn't tell which bar was which).
 */
export const CLOSE_ZOOM = 16;

/** The wide web map's zoom buttons (discoverMapDom.ts), so Find me can sit under them. */
export const ZOOM_BUTTON = 40;

/** A camera on one bar, close enough that its pin writes the name. */
export function cameraOn(at: { latitude: number; longitude: number }): Camera {
  return { latitude: at.latitude, longitude: at.longitude, zoom: CLOSE_ZOOM };
}

/** What the map shows: the last refit (`fit`), the bar a list row is resting on (`focus`), and the camera given (`at`). */
export interface MapAim {
  fit: Camera | null;
  focus: Camera | null;
  at: Camera | null;
}

/**
 * The camera is whichever came last, a refit or a new hover, so a hover ending
 * never snaps the map back. `fresh`: a new hover moved it (the map's moves
 * start again from there, so the fly isn't taken for the person panning).
 */
export function aimAfter(prev: MapAim, fit: Camera | null, focus: Camera | null): MapAim & { fresh: boolean } {
  const fresh = !!focus && focus !== prev.focus;
  return { fit, focus, at: fresh ? focus : prev.fit !== fit ? fit : prev.at, fresh };
}

let barHover: ReturnType<typeof setTimeout> | undefined;
/** Rest the pointer before a list row moves the map. Leaving cancels it. ponytail: one timer, one Discover screen. */
export function armBarHover(barId: string | null, go: (id: string) => void, ms = 400): void {
  clearTimeout(barHover);
  barHover = barId ? setTimeout(() => go(barId), ms) : undefined;
}

/**
 * How a pin looks on either map (disc-map, disc-map-opt-c): the score in mono
 * on a dark pill with a soft ring and shadow, or a dot while early; while
 * searching, its best match's picture too. The accent when selected. A closed
 * bar is muted and faded, so it reads as history, not a plan. Up close
 * (CLOSE_ZOOM, `zoom` is the map's), logos get bigger. The bar's name is only
 * on the pin under the pointer (`selected`, or `hover` for the map itself).
 */
export function pinLook(pin: MapPin, selected: boolean, accent: { fill: string; text: string }, zoom?: number, hover = false) {
  const close = !pin.top && !pin.closed && zoom !== undefined && zoom >= CLOSE_ZOOM;
  // A pin that writes a name: a searched drink's, or the one bar being hovered.
  const showName = close && (selected || hover);
  const named = !!pin.top || showName;
  const label = pin.top
    ? pinName(pin.top, pin.drinks ?? 1)
    : showName
      ? [pin.score !== null ? formatScore(pin.score) : '', pinName(pin.name, 1)].filter(Boolean).join(' · ')
      : pinLabel(pin);
  // Picked, a pin is a size up: a score 36 tall at 15 (disc-desk-browse), a named one 48 (disc-desk-search).
  const big = selected && !!label;
  // A searched pin (it names a drink) keeps its bar's logo when the drink has no picture; a bar with no score yet shows
  // its logo alone (pinsToDraw), and up close beside its name; score pins have none, as drawn.
  const logo = pin.image ?? (named || !label ? pin.logo : null) ?? null;
  // A named pin's picture sits 5 in from its edge (7 picked); a lone logo needs room for its 2px ring; up close, 4 in.
  // Ten points up on the old marks (22 / 26 / 32 / 36): they were hard to tell apart on the map.
  // Up close the logo stays the larger size even when this pin isn't the one writing its name.
  const marked = close && (showName || !label);
  const logoSize = marked ? (big ? 46 : 42) : pin.top && !big ? 32 : 36;
  const edge = named ? (big ? space.md + 2 : space.md) : big ? space.md : space.sm + 2;
  const height = marked ? logoSize + 2 * space.xs : pin.top ? (big ? 48 : 40) : big ? 36 : label ? 30 : logo ? logoSize + 4 : 18;
  // Scores in mono, names in Geist (disc-desk-search).
  const font: keyof typeof fontFamilies = named ? (big ? 'bodySemiBold' : 'bodyMedium') : 'monoMedium';
  return {
    label,
    logo,
    logoSize,
    font,
    fontSize: big ? type.label.fontSize : type.caption.fontSize,
    minWidth: big && !named ? 56 : label ? 44 : height,
    height,
    paddingLeft: label ? (logo ? (showName ? space.xs - 1 : big ? space.xs + 3 : space.xs + 1) : edge) : 0,
    paddingRight: label ? edge : 0,
    gap: label && named ? space.xs + 2 : space.xs,
    borderWidth: selected && !label ? 2 : 1,
    borderColor: selected ? accent.fill : withAlpha(backbar.dark.ink, 0.2),
    backgroundColor: selected ? accent.fill : pin.score === null && !pin.drinks && !pin.matches && !logo ? backbar.light.muted : backbar.dark.raised,
    boxShadow: `0 ${big ? 6 : 4}px ${big ? 18 : 12}px ${withAlpha(backbar.dark.ground, big ? 0.5 : 0.45)}`,
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
 * Several bars within a short walk opens at street level instead, on them.
 */
const NEAR_ME_ZOOM = 13.5;
const CROWD_KM = 1;
const CROWD_BARS = 6;

/** True when enough bars sit within a kilometre to open near-me at street level. ponytail: a walking-radius count, not a density grid; raise CROWD_BARS if a small town opens too tight. */
function crowded(area: { latitude: number; longitude: number }, bars: readonly { latitude: number | null; longitude: number | null }[]): boolean {
  const cos = Math.cos((area.latitude * Math.PI) / 180);
  const limit = CROWD_KM * CROWD_KM;
  let n = 0;
  for (const b of bars) {
    if (b.latitude === null || b.longitude === null) continue;
    const dLat = (b.latitude - area.latitude) * KM_PER_DEG;
    const dLng = (b.longitude - area.longitude) * KM_PER_DEG * cos;
    if (dLat * dLat + dLng * dLng <= limit && ++n >= CROWD_BARS) return true;
  }
  return false;
}

/** A camera for an area: near me, the person's neighbourhood (street level when it's crowded); a map area, its whole circle; null for a city or anywhere. */
export function cameraForArea(area: Area, around: readonly { latitude: number | null; longitude: number | null }[] = []): Camera | null {
  if (area.kind !== 'point') return null;
  if (area.source === 'me') return { latitude: area.latitude, longitude: area.longitude, zoom: crowded(area, around) ? CLOSE_ZOOM : NEAR_ME_ZOOM };
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
