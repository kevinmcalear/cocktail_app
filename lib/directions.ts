/**
 * Directions to a bar from its saved coordinates (free map links, no API):
 * the iPhone sheet offers Apple Maps, Google Maps and Waze; Android hands a
 * geo: link to the person's maps app; the web opens Google Maps in a new tab.
 * Pure; checked by lib/directions.check.ts.
 */
import { distanceKm } from './discoverDrinks';
import { formatDistance } from './nearMe';

export interface Destination {
  name: string;
  latitude: number;
  longitude: number;
}

export type MapsApp = 'apple' | 'google' | 'waze';

const at = (d: Destination) => `${d.latitude},${d.longitude}`;

/** Google Maps directions on the web (and the Google Maps app when a phone hands the link to it). */
export const googleMapsUrl = (d: Destination) => `https://www.google.com/maps/dir/?api=1&destination=${at(d)}`;

/** Each app's own link; Google's app link falls back to googleMapsUrl when it isn't installed. */
export function appUrl(app: MapsApp, d: Destination): string {
  switch (app) {
    case 'apple':
      return `https://maps.apple.com/?daddr=${at(d)}&q=${encodeURIComponent(d.name)}`;
    case 'google':
      return `comgooglemaps://?daddr=${at(d)}`;
    case 'waze':
      return `waze://?ll=${at(d)}&navigate=yes`;
  }
}

/** Android: the person's chosen maps app, with the bar's name on the pin. */
export const geoUrl = (d: Destination) => `geo:0,0?q=${at(d)}(${encodeURIComponent(d.name)})`;

/** "42 Gertrude St, Fitzroy": the street and the neighbourhood (or city), whichever it has. */
export function addressLine(p: { address_line: string | null; locality: string | null; city: string | null }): string | null {
  const parts = [p.address_line, p.locality ?? p.city].filter((x): x is string => !!x?.trim());
  return parts.length ? parts.join(', ') : null;
}

/** "400 m" from where the person is, or null without both points. */
export function awayFrom(from: { latitude: number; longitude: number } | null | undefined, to: { latitude: number | null; longitude: number | null }, imperial = false): string | null {
  if (!from || to.latitude == null || to.longitude == null) return null;
  return formatDistance(distanceKm(from, { latitude: to.latitude, longitude: to.longitude }), imperial);
}

/** "about 5 min on foot" at a walking 5 km/h, up to an hour; null past that. */
export function walkTime(from: { latitude: number; longitude: number } | null | undefined, to: { latitude: number | null; longitude: number | null }): string | null {
  if (!from || to.latitude == null || to.longitude == null) return null;
  const minutes = Math.max(1, Math.round((distanceKm(from, { latitude: to.latitude, longitude: to.longitude }) / 5) * 60));
  return minutes <= 60 ? `about ${minutes} min on foot` : null;
}
