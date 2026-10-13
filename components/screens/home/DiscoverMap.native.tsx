import { Camera, GeoJSONSource, Layer, Map, Marker, NativeUserLocation, type CameraRef, type GeoJSONSourceRef, type MapRef, type PressEventWithFeatures, type ViewState } from '@maplibre/maplibre-react-native';
import { Image } from 'expo-image';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';

import { backbar, fontFamilies, radius, type } from '@/constants/tokens';
import { useLocationAccess } from '@/hooks/useLocationAccess';
import { AREA_CLUSTER, areaLook, areasFrom, DOT_PAINT, dotsFilter, dotsOf, MAP_STYLE, pinDescription, pinLook, pinsToDraw, viewportFrom, type MapArea, type MapView } from '@/lib/discoverMap';

import type { DiscoverMapProps } from './DiscoverMap';

/** MapLibre Native needs no API key, so every native build has a map. */
export const mapAvailable = true;

/**
 * The native map: MapLibre Native with the same OpenFreeMap style and the
 * same pins as the web map (DiscoverMap.web.tsx), so it looks the same on a
 * phone as in the browser.
 */
export function DiscoverMap({ pins, selectedId, onSelect, onViewportChange, camera, scheme, accent, compact, me, style }: DiscoverMapProps) {
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const dotsRef = useRef<GeoJSONSourceRef>(null);
  // Options C and D (13 Oct), as on the web map: every bar is a dot the map draws itself (one layer, cheap
  // at any count), gathered into areas zoomed out; only the best few in view are pins, since a view per pin
  // is costly on a phone (each a native view, mounted again whenever the set changes). What's on screen:
  const [view, setView] = useState<MapView | null>(null);
  const viewRef = useRef(view);
  // Rebuilt only when the pins, the selection or the view change (the pins come memoized), never on a plain re-render.
  const rich = useMemo(() => pinsToDraw(pins, view, selectedId), [pins, view, selectedId]);
  const dots = useMemo(() => dotsOf(pins), [pins]);
  const filter = useMemo(() => dotsFilter(rich.map((p) => p.id)), [rich]);
  const [areas, setAreas] = useState<{ key: string; list: MapArea[] }>({ key: '', list: [] });
  // Where the map starts; later cameras move it (below).
  const [start] = useState(camera);
  // On iOS a pin tap also reaches the map's own tap handler just after, which
  // would clear the selection at once; skip map taps that closely follow a pin tap.
  const pinTappedAt = useRef(0);
  // "You are here" is the system's own dot (iOS and Android draw it and keep it moving), shown
  // whenever location is allowed, so it's there even when near me fell back to the last place.
  // Never mounted without permission: on iOS mounting it would ask, and Android checks only as
  // the style loads, so a grant from Settings (rechecked on return) remounts it.
  const access = useLocationAccess(me ? 'found' : null);
  const showMe = access === 'granted' || !!me;

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

  // A dot opens its bar like a pin does.
  const onDot = (e: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const id = e.nativeEvent.features[0]?.properties?.id;
    if (typeof id !== 'string') return;
    pinTappedAt.current = Date.now();
    onSelect(id);
  };
  // An area zooms in until it comes apart.
  const onArea = async (area: MapArea) => {
    const zoom = await dotsRef.current?.getClusterExpansionZoom(area.id);
    if (zoom !== undefined) cameraRef.current?.easeTo({ center: [area.longitude, area.latitude], zoom, duration: 400 });
  };

  // The area labels: MapLibre's clusters in the loaded tiles (querySourceFeatures underneath), once the map settles.
  const syncAreas = async () => {
    const found = await dotsRef.current?.getData(['has', 'point_count']).catch(() => null);
    if (!found) return;
    const list = areasFrom(found.features, viewRef.current);
    const key = list.map((a) => `${a.id}:${a.label}:${a.latitude}:${a.longitude}`).join('|');
    setAreas((now) => (now.key === key ? now : { key, list }));
  };

  // Every settled move (ours too) picks the pins for what's on screen; only the person's own count for "search this area".
  const onMoved = ({ nativeEvent: { userInteraction, center, bounds, zoom } }: NativeSyntheticEvent<ViewState & { userInteraction?: boolean }>) => {
    const next = { bounds, zoom };
    viewRef.current = next;
    setView(next);
    void syncAreas();
    if (userInteraction) onViewportChange(viewportFrom({ lng: center[0], lat: center[1] }, bounds, zoom));
  };
  // The first view, before any move.
  const onLoaded = async () => {
    const state = await mapRef.current?.getViewState().catch(() => null);
    if (state && !viewRef.current) onMoved({ nativeEvent: state } as NativeSyntheticEvent<ViewState>);
  };

  return (
    <Map
      ref={mapRef}
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
      onDidFinishLoadingMap={() => void onLoaded()}
      onDidFinishRenderingMapFully={() => void syncAreas()}
    >
      <Camera
        ref={cameraRef}
        initialViewState={start ? { center: [start.longitude, start.latitude], zoom: start.zoom } : { center: [0, 20], zoom: 1.5 }}
      />
      <GeoJSONSource id="discover-dots" ref={dotsRef} data={dots} {...AREA_CLUSTER} onPress={onDot}>
        <Layer id="discover-dots" type="circle" filter={filter} paint={DOT_PAINT} />
      </GeoJSONSource>
      {areas.list.map((area) => (
        <Marker key={`area-${area.id}`} id={`area-${area.id}`} lngLat={[area.longitude, area.latitude]} onPress={() => {
            pinTappedAt.current = Date.now();
            void onArea(area);
          }}
        >
          <View role="button" aria-label={`${area.label}. Zoom in to see each bar`} style={styles.area}>
            <Text style={styles.areaLabel}>{area.label}</Text>
          </View>
        </Marker>
      ))}
      {showMe ? <NativeUserLocation mode="heading" /> : null}
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
                    borderWidth: look.borderWidth,
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
                {look.label ? <Text style={[styles.label, { color: look.color, fontSize: look.fontSize, fontFamily: fontFamilies[look.font] }]}>{look.label}</Text> : null}
              </View>
            </Marker>
          );
        })}
      </Fragment>
    </Map>
  );
}

// ponytail: no shadow under the pins and areas here, unlike the web map; a marker's view may clip a shadow
// that falls outside it. Add areaLook.boxShadow / pinLook().boxShadow once checked on a phone.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  pin: { flexDirection: 'row', borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  logo: { borderRadius: radius.pill, backgroundColor: backbar.light.surface },
  label: { fontFamily: fontFamilies.monoMedium, fontSize: type.caption.fontSize },
  area: { height: areaLook.height, paddingHorizontal: areaLook.paddingHorizontal, borderRadius: radius.pill, borderWidth: 1, borderColor: areaLook.borderColor, backgroundColor: areaLook.backgroundColor, justifyContent: 'center' },
  areaLabel: { fontFamily: fontFamilies.monoMedium, fontSize: type.caption.fontSize, color: areaLook.color },
});
