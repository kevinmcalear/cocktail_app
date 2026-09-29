import Constants from 'expo-constants';
import { Image, type ImageRef } from 'expo-image';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { backbar } from '@/constants/tokens';
import { pinLabel, type MapPin, type Viewport } from '@/lib/discoverMap';

import type { DiscoverMapProps } from './DiscoverMap';

/**
 * Android draws Google Maps, which needs an API key in the build
 * (GOOGLE_MAPS_ANDROID_API_KEY, see app.config.ts). Without one the map
 * would be blank, so Discover keeps to the list there.
 */
export const mapAvailable = Platform.OS === 'ios' || !!Constants.expoConfig?.android?.config?.googleMaps?.apiKey;

const viewportOf = (e: { coordinates: { latitude?: number; longitude?: number }; latitudeDelta: number; longitudeDelta: number }): Viewport | null =>
  e.coordinates.latitude === undefined || e.coordinates.longitude === undefined
    ? null
    : { latitude: e.coordinates.latitude, longitude: e.coordinates.longitude, latitudeDelta: e.latitudeDelta, longitudeDelta: e.longitudeDelta };

// Apple draws an annotation icon as a 32pt circle (patches/expo-maps), 96px at 3x;
// Google draws the bitmap as is, about 36dp.
const LOGO_PX = 96;

// Pin logos, loaded once per URL for the session. ponytail: never released,
// fine for the few hundred bars a session sees (small bitmaps). Upgrade path:
// release the refs no pin uses.
const logoRefs = new Map<string, ImageRef>();

/** The loaded logo for each pin's URL. A logo that fails to load leaves the plain pin. */
function usePinLogos(pins: MapPin[]): Record<string, ImageRef> {
  const [refs, setRefs] = useState<Record<string, ImageRef>>(() => Object.fromEntries(logoRefs));
  const key = [...new Set(pins.flatMap((p) => (p.logo ? [p.logo] : [])))].join('\n');
  useEffect(() => {
    const missing = key ? key.split('\n').filter((u) => !logoRefs.has(u)) : [];
    if (!missing.length) return;
    let live = true;
    void Promise.all(
      missing.map((u) =>
        Image.loadAsync(u, { maxWidth: LOGO_PX, maxHeight: LOGO_PX }).then(
          (ref) => void logoRefs.set(u, ref),
          () => undefined,
        ),
      ),
    ).then(() => {
      if (live) setRefs(Object.fromEntries(logoRefs));
    });
    return () => {
      live = false;
    };
  }, [key]);
  return refs;
}

/**
 * Native map through expo-maps: Apple Maps on iOS (score labels as
 * annotations), Google Maps on Android (markers with the score as title).
 * Bars with a logo show it as the pin. Follows the app's light or dark scheme.
 */
export function DiscoverMap({ pins, selectedId, onSelect, onViewportChange, camera, scheme, accent, style }: DiscoverMapProps) {
  const apple = useRef<AppleMaps.MapView>(null);
  const google = useRef<GoogleMaps.MapView>(null);
  const logos = usePinLogos(pins);
  // Camera moves we make ourselves don't count as the person moving the map.
  const quietUntil = useRef(0);

  // Move only when asked to (a new camera), never on every re-render, so the
  // person's own panning isn't undone.
  useEffect(() => {
    if (!camera) return;
    quietUntil.current = Date.now() + 1500;
    const position = { coordinates: { latitude: camera.latitude, longitude: camera.longitude }, zoom: camera.zoom };
    apple.current?.setCameraPosition(position);
    google.current?.setCameraPosition({ ...position, duration: 400 });
  }, [camera]);

  const onMove = (e: Parameters<NonNullable<AppleMaps.MapProps['onCameraMove']>>[0]) => {
    if (Date.now() < quietUntil.current) return;
    const v = viewportOf(e);
    if (v) onViewportChange(v);
  };
  const initial = camera ? { coordinates: { latitude: camera.latitude, longitude: camera.longitude }, zoom: camera.zoom } : undefined;

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        ref={apple}
        style={[styles.fill, style]}
        colorScheme={scheme === 'dark' ? AppleMaps.MapColorScheme.DARK : AppleMaps.MapColorScheme.LIGHT}
        cameraPosition={initial}
        uiSettings={{ compassEnabled: false, togglePitchEnabled: false, myLocationButtonEnabled: false }}
        properties={{ pointsOfInterest: { including: [] }, selectionEnabled: false }}
        annotations={pins.map((p) => {
          const selected = p.id === selectedId;
          const icon = p.logo ? logos[p.logo] : undefined;
          // Apple draws the text over the icon, so a logo pin carries its score in the title under it.
          const label = pinLabel(p);
          return {
            id: p.id,
            coordinates: { latitude: p.latitude, longitude: p.longitude },
            title: icon && label ? `${p.name} · ${label}` : p.name,
            text: icon ? '' : label || '·',
            icon,
            // Ink pins read on both map schemes; early ones are muted; the selected one takes the accent.
            // On a logo pin this is the ring: light, like the web pins, or the accent.
            backgroundColor: selected ? accent.fill : icon ? backbar.dark.ink : p.score === null ? backbar.light.muted : backbar.light.ink,
            textColor: selected ? accent.text : backbar.dark.ink,
          };
        })}
        onAnnotationClick={(a) => onSelect(a.id ?? null)}
        onMarkerClick={(m) => onSelect(m.id ?? null)}
        onMapClick={() => onSelect(null)}
        onCameraMove={onMove}
      />
    );
  }
  return (
    <GoogleMaps.View
      ref={google}
      style={[styles.fill, style]}
      colorScheme={scheme === 'dark' ? GoogleMaps.MapColorScheme.DARK : GoogleMaps.MapColorScheme.LIGHT}
      cameraPosition={initial}
      uiSettings={{ compassEnabled: false, mapToolbarEnabled: false, myLocationButtonEnabled: false }}
      markers={pins.map((p) => ({
        id: p.id,
        coordinates: { latitude: p.latitude, longitude: p.longitude },
        title: p.name,
        snippet: p.score === null ? 'Early' : pinLabel(p),
        ...(p.logo && logos[p.logo] ? { icon: logos[p.logo], anchor: { x: 0.5, y: 0.5 } } : null),
        zIndex: p.id === selectedId ? 2 : 1,
      }))}
      onMarkerClick={(m) => onSelect(m.id ?? null)}
      onMapClick={() => onSelect(null)}
      onCameraMove={onMove}
    />
  );
}

/** Apple and Google maps show their own legal notices. */
export function MapCredit() {
  return null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
