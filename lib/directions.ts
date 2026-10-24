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

/**
 * The bar's own listing in a maps app (its photos, hours, reviews and a
 * Directions button), found by name: Apple searches near where the bar is,
 * Google by name and street. A listing rather than a route to the address.
 */
export function listingUrl(app: 'apple' | 'google', d: Destination & { address?: string | null }): string {
  if (app === 'apple') return `https://maps.apple.com/?q=${encodeURIComponent(d.name)}&sll=${at(d)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address ? `${d.name}, ${d.address}` : at(d))}`;
}

/** Android: the listing in the person's maps app, searched by name around the bar. */
export const geoListingUrl = (d: Destination & { address?: string | null }) => `geo:${at(d)}?q=${encodeURIComponent([d.name, d.address].filter(Boolean).join(', '))}`;

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
