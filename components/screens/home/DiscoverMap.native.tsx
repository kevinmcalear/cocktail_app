import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef, type GeoJSONSourceRef, type PressEventWithFeatures, type ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { Image } from 'expo-image';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';

import { backbar, fontFamilies, radius, type } from '@/constants/tokens';
import { dotsOf, MAP_STYLE, pinDescription, pinLook, viewportFrom } from '@/lib/discoverMap';

import type { DiscoverMapProps } from './DiscoverMap';

/** MapLibre Native needs no API key, so every native build has a map. */
export const mapAvailable = true;

/**
 * Pins drawn as views (logo, score), best first. A view per pin is costly on
 * a phone (each is a native view, mounted again whenever the set changes), so
 * past these (and the selected one) the rest are labelled dots the map draws
 * itself, gathered into counted clusters (light, so a group of bars reads
 * apart from one bar's drink count) when they crowd.
 */
const RICH_PINS = 12;

/**
 * The native map: MapLibre Native with the same OpenFreeMap style and the
 * same pins as the web map (DiscoverMap.web.tsx), so it looks the same on a
 * phone as in the browser.
 */
export function DiscoverMap({ pins, selectedId, onSelect, onViewportChange, camera, scheme, accent, compact, style }: DiscoverMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const dotsRef = useRef<GeoJSONSourceRef>(null);
  // Rebuilt only when the pins or the selection change (the pins come memoized), never on a plain re-render.
  const rich = useMemo(() => pins.filter((p, i) => i < RICH_PINS || p.id === selectedId), [pins, selectedId]);
  const dots = useMemo(() => dotsOf(pins.filter((p, i) => i >= RICH_PINS && p.id !== selectedId)), [pins, selectedId]);
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
  const order = android ? rich.map((p) => p.id).join('|') : 'pins';

  // A dot opens its bar; a cluster zooms in until it comes apart.
  const onDot = async (e: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const f = e.nativeEvent.features[0];
    if (!f) return;
    pinTappedAt.current = Date.now();
    const props = f.properties ?? {};
    if (props.cluster && f.geometry.type === 'Point') {
      const zoom = await dotsRef.current?.getClusterExpansionZoom(props.cluster_id);
      const [lng, lat] = f.geometry.coordinates;
      if (zoom !== undefined) cameraRef.current?.easeTo({ center: [lng, lat], zoom, duration: 400 });
    } else if (typeof props.id === 'string') {
      onSelect(props.id);
    }
  };
  const ink = backbar.light.ink;
  const ring = backbar.dark.ink;

  // Only the person's own moves count for "search this area".
  const onMoved = (e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const { userInteraction, center, bounds, zoom } = e.nativeEvent;
    if (userInteraction) onViewportChange(viewportFrom({ lng: center[0], lat: center[1] }, bounds, zoom));
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
      <GeoJSONSource id="discover-dots" ref={dotsRef} data={dots} cluster clusterRadius={44} onPress={(e) => void onDot(e)}>
        <Layer
          id="discover-clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{ 'circle-color': ring, 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 17, 50, 21], 'circle-stroke-color': ink, 'circle-stroke-width': 2 }}
        />
        <Layer
          id="discover-cluster-counts"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': type.caption.fontSize, 'text-allow-overlap': true }}
          paint={{ 'text-color': ink }}
        />
        <Layer
          id="discover-dots"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{ 'circle-color': ink, 'circle-radius': ['case', ['==', ['get', 'label'], ''], 6, 13], 'circle-stroke-color': ring, 'circle-stroke-width': 2 }}
        />
        <Layer
          id="discover-dot-labels"
          type="symbol"
          filter={['all', ['!', ['has', 'point_count']], ['!=', ['get', 'label'], '']]}
          layout={{ 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': type.caption.fontSize - 1, 'text-allow-overlap': true }}
          paint={{ 'text-color': ring }}
        />
      </GeoJSONSource>
      <Fragment key={order}>
        {rich.map((pin, i) => {
          const selected = pin.id === selectedId;
          const look = pinLook(pin, selected, accent);
          return (
            <Marker
              key={pin.id}
              id={pin.id}
              lngLat={[pin.longitude, pin.latitude]}
              style={android ? { zIndex: rich.length - i } : undefined}
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
