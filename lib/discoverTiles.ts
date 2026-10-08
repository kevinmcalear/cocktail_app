/**
 * Map tiles for Discover's pins: the world cut into the usual web-mercator
 * squares (as map tiles are), so what the map shows loads a tile at a time,
 * nearest the middle first, and a tile already loaded is never asked for
 * again: panning back, or zooming into one, reuses it. Pure; checked by
 * lib/discoverTiles.check.ts. The queries are hooks/useDiscoverDrinks.ts.
 */
import type { Viewport } from './discoverMap';

export interface Tile {
  z: number;
  x: number;
  y: number;
}

export interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Levels tiles come in: few, so zooming a little reuses what's there. 2 is the whole world in 16. */
export const TILE_LEVELS = [2, 5, 8, 11] as const;

const MAX_LAT = 85.0511;

function lngToX(lng: number, z: number): number {
  const n = 2 ** z;
  return Math.min(n - 1, Math.max(0, Math.floor(((lng + 180) / 360) * n)));
}

function latToY(lat: number, z: number): number {
  const n = 2 ** z;
  const rad = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)));
}

function yToLat(y: number, z: number): number {
  const m = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(m));
}

/** A tile's edges in degrees. */
export function tileBox({ z, x, y }: Tile): Box {
  const n = 2 ** z;
  return { west: (x / n) * 360 - 180, east: ((x + 1) / n) * 360 - 180, north: yToLat(y, z), south: yToLat(y + 1, z) };
}

/**
 * The level for a view: the finest whose tiles are at least as wide as the
 * view, so a view needs at most 2 by 2 tiles.
 */
export function tileLevel(v: Viewport): number {
  const span = Math.max(Math.abs(v.longitudeDelta), 1e-6);
  const fits = Math.floor(Math.log2(360 / span));
  return [...TILE_LEVELS].reverse().find((z) => z <= fits) ?? TILE_LEVELS[0];
}

/** The tiles a view covers, the one under its middle first, then the nearest. */
export function tilesFor(v: Viewport): Tile[] {
  const z = tileLevel(v);
  const halfLat = Math.abs(v.latitudeDelta) / 2;
  const halfLng = Math.abs(v.longitudeDelta) / 2;
  const x0 = lngToX(v.longitude - halfLng, z);
  const x1 = lngToX(v.longitude + halfLng, z);
  const y0 = latToY(v.latitude + halfLat, z);
  const y1 = latToY(v.latitude - halfLat, z);
  const cx = lngToX(v.longitude, z);
  const cy = latToY(v.latitude, z);
  const tiles: Tile[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push({ z, x, y });
  return tiles.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
}

/** The coarser tiles (by level) that hold this one, nearest level first: one already loaded answers for it. */
export function parentTiles(t: Tile): Tile[] {
  return TILE_LEVELS.filter((z) => z < t.z)
    .reverse()
    .map((z) => ({ z, x: t.x >> (t.z - z), y: t.y >> (t.z - z) }));
}

/** Whether a point is in a box (the east edge belongs to the next tile). */
export function inBox(p: { latitude: number | null; longitude: number | null }, b: Box): boolean {
  if (p.latitude === null || p.longitude === null) return false;
  return p.latitude >= b.south && p.latitude <= b.north && p.longitude >= b.west && p.longitude < b.east;
}
