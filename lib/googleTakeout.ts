import { distanceKm } from './discoverDrinks';

/**
 * Google Maps places from the person's own Takeout export, read on the device
 * (disc-google-import). Two shapes, neither documented by Google:
 * "Saved Places.json" from Maps (your places), a GeoJSON FeatureCollection,
 * and one CSV per saved list from Saved (Title, Note, URL), whose URLs mostly
 * carry no coordinates. Then the places are matched to our bars by name and
 * place. Nothing here keeps the file: only the bars someone ticks are saved,
 * as loves. Pure; checked by lib/googleTakeout.check.ts.
 */

export interface SavedPlace {
  name: string;
  latitude: number | null;
  longitude: number | null;
  /** Saved Places.json has one; the CSV lists don't. */
  address: string | null;
}

export type TakeoutRead = { ok: true; places: SavedPlace[] } | { ok: false; reason: string };

/** More than anyone saves; a bigger file is something else. */
export const MAX_PLACES = 5000;

const WRONG_FILE = 'That isn’t a Google Maps file. Pick Saved Places.json or a saved list’s .csv from the Takeout zip.';

/** Reads Saved Places.json or a saved list's CSV. */
export function readTakeout(text: string): TakeoutRead {
  const body = text.replace(/^﻿/, '').trim();
  if (!body) return { ok: false, reason: 'That file is empty.' };
  const places = body.startsWith('{') || body.startsWith('[') ? fromJson(body) : fromCsv(body);
  if (!places) return { ok: false, reason: WRONG_FILE };
  if (!places.length) return { ok: false, reason: 'No named places in that file.' };
  return { ok: true, places: places.slice(0, MAX_PLACES) };
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function fromJson(body: string): SavedPlace[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const features = Array.isArray(parsed) ? parsed : obj(parsed).features;
  if (!Array.isArray(features)) return null;
  const places: SavedPlace[] = [];
  for (const f of features) {
    const props = obj(obj(f).properties);
    // Newer exports: properties.location.name; older: Title and Location["Business Name"].
    const loc = obj(props.location);
    const oldLoc = obj(props.Location);
    const name = str(loc.name) ?? str(props.Title) ?? str(oldLoc['Business Name']) ?? str(props.name);
    if (!name) continue;
    const geo = obj(oldLoc['Geo Coordinates']);
    const [lng, lat] = Array.isArray(obj(obj(f).geometry).coordinates) ? (obj(obj(f).geometry).coordinates as unknown[]) : [];
    const point = coords(lat, lng) ?? coords(geo.Latitude, geo.Longitude) ?? coordsInUrl(str(props.google_maps_url) ?? str(props['Google Maps URL']));
    places.push({ name, ...(point ?? NO_POINT), address: str(loc.address) ?? str(oldLoc.Address) });
  }
  return places;
}

function fromCsv(body: string): SavedPlace[] | null {
  const [head, ...rows] = csvRows(body);
  const cols = (head ?? []).map((c) => c.trim().toLowerCase());
  const title = cols.indexOf('title');
  if (title < 0) return null;
  const url = cols.indexOf('url');
  const places: SavedPlace[] = [];
  for (const row of rows) {
    const name = str(row[title]);
    if (!name) continue;
    places.push({ name, ...(coordsInUrl(url < 0 ? null : str(row[url])) ?? NO_POINT), address: null });
  }
  return places;
}

/** RFC 4180 rows: quoted fields may hold commas, line breaks and doubled quotes. */
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else field += c;
  }
  if (field || row.length) endRow();
  return rows;
}

const NO_POINT = { latitude: null, longitude: null };

function coords(lat: unknown, lng: unknown): { latitude: number; longitude: number } | null {
  const a = typeof lat === 'string' ? Number(lat) : lat;
  const b = typeof lng === 'string' ? Number(lng) : lng;
  if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  // Places Google can't place come out at 0,0.
  if (Math.abs(a) > 90 || Math.abs(b) > 180 || (a === 0 && b === 0)) return null;
  return { latitude: a, longitude: b };
}

const URL_POINTS = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll)=(-?\d+\.\d+)(?:,|%2C)\+?(-?\d+\.\d+)/i, /\/search\/(-?\d+\.\d+)(?:,|%2C)\+?(-?\d+\.\d+)/i];

/** A point in a Google Maps link, when it has one (dropped pins and some places do). */
export function coordsInUrl(url: string | null): { latitude: number; longitude: number } | null {
  if (!url) return null;
  for (const re of URL_POINTS) {
    const m = url.match(re);
    if (m) return coords(Number(m[1]), Number(m[2]));
  }
  return null;
}

// --- matching ---

export interface BarCandidate {
  id: string;
  display_name: string;
  latitude: number | null;
  longitude: number | null;
  locality: string | null;
  city: string | null;
}

export interface PlaceMatch<B extends BarCandidate> {
  bar: B;
  /** The name Google has for it. */
  savedAs: string;
  /** Same name and within NEAR_M: ticked to start with. Anything looser waits for the person. */
  sure: boolean;
}

/** As close as a saved place and our bar must be. */
export const NEAR_M = 150;
/** A same-named bar this close is probably it, with one side's pin off: shown, not ticked. */
const LOOSE_M = 1000;
/** A name-only place matching more bars than this tells us nothing. */
const MAX_SAME_NAME = 3;

/** Words that come and go in a bar's name ("The Everleigh", "Little Rye Cocktail Bar"). */
const FILLER = new Set(['the', 'a', 'an', 'and', 'bar', 'cocktail', 'cocktails', 'lounge']);

/** Lower case, no accents or punctuation, "&" as "and". */
export function foldWords(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The words that name it, or all of them when the name is only filler ("The Bar"). */
function core(name: string): string[] {
  const words = foldWords(name);
  const kept = words.filter((w) => !FILLER.has(w));
  return kept.length ? kept : words;
}

/** 'same' when the names agree past filler; 'part' when one's words all sit in the other's. */
export function nameMatch(a: string, b: string): 'same' | 'part' | null {
  const x = core(a);
  const y = core(b);
  if (!x.length || !y.length) return null;
  if (x.join(' ') === y.join(' ')) return 'same';
  const [short, long] = x.length <= y.length ? [x, new Set(y)] : [y, new Set(x)];
  return short.some((w) => w.length >= 3) && short.every((w) => long.has(w)) ? 'part' : null;
}

/** About 1.1 km squares, so a place checks the bars in its square and the eight around it. */
const cell = (lat: number, lng: number) => `${Math.floor(lat * 100)}:${Math.floor(lng * 100)}`;

/**
 * Our bars among the saved places, one row per bar, sure ones first. A place
 * with a point matches a bar within NEAR_M by name (or a same-named one a bit
 * further, not ticked); a place with no point matches same-named bars in the
 * address's city, or anywhere when there's no address, up to MAX_SAME_NAME.
 * `count` is how many places matched.
 */
export function matchPlaces<B extends BarCandidate>(places: SavedPlace[], bars: B[]): { matches: PlaceMatch<B>[]; count: number } {
  const grid = new Map<string, B[]>();
  const byName = new Map<string, B[]>();
  for (const b of bars) {
    if (b.latitude != null && b.longitude != null) {
      const k = cell(b.latitude, b.longitude);
      grid.set(k, [...(grid.get(k) ?? []), b]);
    }
    const k = core(b.display_name).join(' ');
    byName.set(k, [...(byName.get(k) ?? []), b]);
  }

  const best = new Map<string, PlaceMatch<B> & { m: number }>();
  const keep = (bar: B, place: SavedPlace, sure: boolean, m: number) => {
    const had = best.get(bar.id);
    if (!had || (sure && !had.sure) || (sure === had.sure && m < had.m)) best.set(bar.id, { bar, savedAs: place.name, sure, m });
  };

  let count = 0;
  for (const place of places) {
    let found = false;
    if (place.latitude != null && place.longitude != null) {
      const lat = Math.floor(place.latitude * 100);
      const lng = Math.floor(place.longitude * 100);
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (const b of grid.get(`${lat + i}:${lng + j}`) ?? []) {
            const m = distanceKm(place as { latitude: number; longitude: number }, b as { latitude: number; longitude: number }) * 1000;
            const name = nameMatch(place.name, b.display_name);
            if (!name || m > LOOSE_M || (name === 'part' && m > NEAR_M)) continue;
            keep(b, place, name === 'same' && m <= NEAR_M, m);
            found = true;
          }
    }
    if (!found) {
      // No point, or our bar has none: the name, narrowed by the address when there is one.
      const named = (byName.get(core(place.name).join(' ')) ?? []).filter((b) => place.latitude == null || b.latitude == null);
      const address = place.address ? ` ${foldWords(place.address).join(' ')} ` : null;
      const inPlace = address ? named.filter((b) => [b.locality, b.city].some((p) => p && address.includes(` ${foldWords(p).join(' ')} `))) : named;
      if (inPlace.length && inPlace.length <= MAX_SAME_NAME) {
        for (const b of inPlace) keep(b, place, false, Infinity);
        found = true;
      }
    }
    if (found) count++;
  }

  const matches = [...best.values()]
    .sort((a, b) => Number(b.sure) - Number(a.sure) || a.bar.display_name.localeCompare(b.bar.display_name))
    .map(({ bar, savedAs, sure }) => ({ bar, savedAs, sure }));
  return { matches, count };
}
