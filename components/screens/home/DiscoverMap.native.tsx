import { Camera, Map, Marker, type CameraRef, type ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { Image } from 'expo-image';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';

import { backbar, fontFamilies, radius, type } from '@/constants/tokens';
import { MAP_STYLE, pinDescription, pinLook, viewportFrom } from '@/lib/discoverMap';

import type { DiscoverMapProps } from './DiscoverMap';

/** MapLibre Native needs no API key, so every native build has a map. */
export const mapAvailable = true;

/**
 * The native map: MapLibre Native with the same OpenFreeMap style and the
 * same pins as the web map (DiscoverMap.web.tsx), so it looks the same on a
 * phone as in the browser.
 */
export function DiscoverMap({ pins, selectedId, onSelect, onViewportChange, camera, scheme, accent, compact, style }: DiscoverMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  // Where the map starts; later cameras move it (below).
  const [start] = useState(camera);
  // On iOS a pin tap also reaches the map's own tap handler just after, which
  // would clear the selection at once; skip map taps that closely follow a pin tap.
  const pinTappedAt = useRef(0);

  // Move only when asked to (a new camera), never on every re-render, so the
  // person's own panning isn't undone.
  useEffect(() => {
    if (!camera || camera === start) return;
    cameraRef.current?.easeTo({ center: [camera.longitude, camera.latitude], zoom: camera.zoom, duration: 500 });
  }, [camera, start]);

  // Android hit-tests overlapping markers in the order they were added and
  // takes the first, but draws later ones on top, so a tap on the pin you can
  // see opened the one under it. So on Android, draw them in the order they're
  // hit: the first pin (the best, as pins come best first) on top, and remount
  // them whenever the set changes so they're added in this order.
  // ponytail: works around MapLibre RN 11.4 MarkerViewManager.findMarkerAtPoint;
  // drop this once it checks the topmost marker first (a native fix, so a new binary).
  const android = Platform.OS === 'android';
  const order = android ? pins.map((p) => p.id).join('|') : 'pins';

  // Only the person's own moves count for "search this area".
  const onMoved = (e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const { userInteraction, center, bounds } = e.nativeEvent;
    if (userInteraction) onViewportChange(viewportFrom({ lng: center[0], lat: center[1] }, bounds));
  };

  return (
    <Map
      style={[styles.fill, style]}
      mapStyle={MAP_STYLE[scheme]}
      // OpenStreetMap asks for a visible credit: on the map when there's room,
      // in the results sheet on phones (MapCredit).
      attribution={!compact}
      attributionPosition={{ bottom: 8, right: 8 }}
      logo={false}
      compass={false}
      touchRotate={false}
      touchPitch={false}
      onPress={() => {
        if (Date.now() - pinTappedAt.current > 400) onSelect(null);
      }}
      onRegionDidChange={onMoved}
    >
      <Camera
        ref={cameraRef}
        initialViewState={start ? { center: [start.longitude, start.latitude], zoom: start.zoom } : { center: [0, 20], zoom: 1.5 }}
      />
      <Fragment key={order}>
        {pins.map((pin, i) => {
          const selected = pin.id === selectedId;
          const look = pinLook(pin, selected, accent);
          return (
            <Marker
              key={pin.id}
              id={pin.id}
              lngLat={[pin.longitude, pin.latitude]}
              style={android ? { zIndex: pins.length - i } : undefined}
              onPress={() => {
                pinTappedAt.current = Date.now();
                onSelect(pin.id);
              }}
            >
              <View
                role="button"
                aria-label={pinDescription(pin)}
                aria-selected={selected}
                style={[
                  styles.pin,
                  {
                    minWidth: look.minWidth,
                    height: look.height,
                    paddingLeft: look.paddingLeft,
                    paddingRight: look.paddingRight,
                    gap: look.gap,
                    borderColor: look.borderColor,
                    backgroundColor: look.backgroundColor,
                    opacity: look.opacity,
                    zIndex: selected ? 2 : 1,
                  },
                ]}
              >
                {look.logo ? (
                  <Image source={look.logo} style={[styles.logo, { width: look.logoSize, height: look.logoSize }]} contentFit="cover" />
                ) : null}
                {look.label ? <Text style={[styles.label, { color: look.color }]}>{look.label}</Text> : null}
              </View>
            </Marker>
          );
        })}
      </Fragment>
    </Map>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pin: { flexDirection: 'row', borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  logo: { borderRadius: radius.pill, backgroundColor: backbar.light.surface },
  label: { fontFamily: fontFamilies.monoMedium, fontSize: type.caption.fontSize },
});
