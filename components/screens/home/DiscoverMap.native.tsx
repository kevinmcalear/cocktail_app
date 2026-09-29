import Constants from 'expo-constants';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { backbar } from '@/constants/tokens';
import { pinLabel, type Viewport } from '@/lib/discoverMap';

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

/**
 * Native map through expo-maps: Apple Maps on iOS (score labels as
 * annotations), Google Maps on Android (markers with the score as title).
 * Follows the app's light or dark scheme.
 * ponytail: no logos on native pins yet (the selected card and the list
 * show them). Upgrade path: expo-image's useImage per pin, passed as the
 * annotation/marker icon.
 */
export function DiscoverMap({ pins, selectedId, onSelect, onViewportChange, camera, scheme, accent, style }: DiscoverMapProps) {
  const apple = useRef<AppleMaps.MapView>(null);
  const google = useRef<GoogleMaps.MapView>(null);
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
          return {
            id: p.id,
            coordinates: { latitude: p.latitude, longitude: p.longitude },
            title: p.name,
            text: pinLabel(p) || '·',
            // Ink pins read on both map schemes; early ones are muted; the selected one takes the accent.
            backgroundColor: selected ? accent.fill : p.score === null ? backbar.light.muted : backbar.light.ink,
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
