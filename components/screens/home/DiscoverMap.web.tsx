import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature, Marker } from 'maplibre-gl';
import { useEffect, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { backbar, MAP_ME, radius } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { AREA_CLUSTER, areasFrom, DOT_PAINT, dotsFilter, dotsOf, MAP_STYLE, pinsToDraw, viewportFrom, type MapArea, type MapView } from '@/lib/discoverMap';

import type { DiscoverMapProps } from './DiscoverMap';
import { areaElement, loadMapStyles, paintPin, styleControls } from './discoverMapDom';

export const mapAvailable = true;

type MapLibre = typeof import('maplibre-gl');

const DOTS = 'discover-dots';

// Only the best few bars in view (pinsToDraw) and the area labels are HTML markers:
// hundreds of them, each moved every frame, made panning slow. Every bar is a dot in the map's own layer.

/** The dots source and layer (the same as the native map's), added again after a style change wipes them. */
function addDots(m: MapLibreMap, data: GeoJSON.FeatureCollection, drawn: readonly string[]) {
  if (m.getSource(DOTS)) return;
  m.addSource(DOTS, { type: 'geojson', data, ...AREA_CLUSTER });
  m.addLayer({ id: DOTS, type: 'circle', source: DOTS, filter: dotsFilter(drawn), paint: DOT_PAINT });
}

/**
 * The web map: MapLibre GL, loaded only in the browser (never in the static
 * render, and never in native bundles), with OpenFreeMap tiles and HTML pins.
 */
export function DiscoverMap({ pins, selectedId, onSelect, onViewportChange, camera, scheme, accent, compact, me, style }: DiscoverMapProps) {
  const host = useRef<ComponentRef<typeof View>>(null);
  const map = useRef<MapLibreMap | null>(null);
  const lib = useRef<MapLibre | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>());
  const meMarker = useRef<Marker | null>(null);
  const dots = useRef<GeoJSON.FeatureCollection>(dotsOf([]));
  // The bars drawn as pins (left out of the dots), what's on screen, and the area labels by key.
  const drawn = useRef<string[]>([]);
  const view = useRef<MapView | null>(null);
  const areas = useRef({ key: '', markers: [] as Marker[] });
  // Set while the map is moving because we moved it.
  const ours = useRef(false);
  const latest = useRef({ onSelect, onViewportChange, pins, selectedId, accent, camera, scheme, me });
  useEffect(() => {
    latest.current = { onSelect, onViewportChange, pins, selectedId, accent, camera, scheme, me };
  });

  // "You are here": a dot with a halo, under the pins.
  const syncMe = () => {
    const m = map.current;
    const ml = lib.current;
    const at = latest.current.me;
    if (!m || !ml) return;
    if (!at) {
      meMarker.current?.remove();
      meMarker.current = null;
      return;
    }
    if (!meMarker.current) {
      const el = document.createElement('span');
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'You are here');
      Object.assign(el.style, {
        width: '18px',
        height: '18px',
        borderRadius: `${radius.pill}px`,
        background: MAP_ME,
        border: `3px solid ${backbar.dark.ink}`,
        boxSizing: 'border-box',
        boxShadow: `0 0 0 8px ${withAlpha(MAP_ME, 0.22)}`,
        pointerEvents: 'none',
        zIndex: '0',
      });
      meMarker.current = new ml.Marker({ element: el });
    }
    meMarker.current.setLngLat([at.longitude, at.latitude]).addTo(m);
  };

  // Options C and D (13 Oct): the best bars in view are pins, the rest dots; zoomed out, areas.
  const syncPins = () => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml) return;
    const { pins: all, selectedId: sel, accent: acc } = latest.current;
    const now = pinsToDraw(all, view.current, sel);
    drawn.current = now.map((p) => p.id);
    if (m.getLayer(DOTS)) m.setFilter(DOTS, dotsFilter(drawn.current));
    const keep = new Set(drawn.current);
    for (const [id, { marker }] of markers.current) {
      if (!keep.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
    for (const pin of now) {
      let entry = markers.current.get(pin.id);
      if (!entry) {
        const el = document.createElement('button');
        el.type = 'button';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          latest.current.onSelect(pin.id);
        });
        entry = { el, marker: new ml.Marker({ element: el }).setLngLat([pin.longitude, pin.latitude]).addTo(m) };
        markers.current.set(pin.id, entry);
      }
      entry.marker.setLngLat([pin.longitude, pin.latitude]);
      paintPin(entry.el, pin, pin.id === sel, acc);
    }
  };

  // The area labels: MapLibre's clusters in view, read back once the map settles.
  const syncAreas = () => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !m.getSource(DOTS)) return;
    const now = areasFrom(m.querySourceFeatures(DOTS, { filter: ['has', 'point_count'] }), view.current);
    const key = now.map((a) => `${a.id}:${a.label}:${a.latitude}:${a.longitude}`).join('|');
    if (key === areas.current.key) return;
    for (const marker of areas.current.markers) marker.remove();
    const zoomIn = (a: MapArea) => () => {
      void (m.getSource(DOTS) as GeoJSONSource).getClusterExpansionZoom(a.id).then((zoom) => {
        ours.current = true;
        m.easeTo({ center: [a.longitude, a.latitude], zoom, duration: 400 });
      });
    };
    areas.current = { key, markers: now.map((a) => new ml.Marker({ element: areaElement(a, zoomIn(a)) }).setLngLat([a.longitude, a.latitude]).addTo(m)) };
  };

  // What's on screen changed: new pins for it.
  const syncView = () => {
    const m = map.current;
    if (!m) return;
    const b = m.getBounds();
    view.current = { bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: m.getZoom() };
    syncPins();
  };

  // Create the map once, in the browser.
  useEffect(() => {
    let cancelled = false;
    const all = markers.current;
    const shown = areas.current;
    void Promise.all([import('maplibre-gl'), loadMapStyles()]).then(([ml]) => {
      const container = host.current as unknown as HTMLElement | null;
      if (cancelled || !container) return;
      lib.current = ml;
      const start = latest.current.camera;
      const m = new ml.Map({
        container,
        // The scheme now, not at mount: it starts light until hydration, and
        // a flip to dark while maplibre loads finds no map to restyle.
        style: MAP_STYLE[latest.current.scheme],
        center: start ? [start.longitude, start.latitude] : [0, 20],
        zoom: start?.zoom ?? 1.5,
        // OpenStreetMap asks for a visible credit: in full here, or in the sheet (MapCredit) on phones.
        attributionControl: compact ? false : { compact: false },
        dragRotate: false,
        pitchWithRotate: false,
      });
      m.touchZoomRotate.disableRotation();
      if (!compact) m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      styleControls(container, latest.current.scheme);
      // Only the person's own moves count for "search this area": every move
      // but the ones we start (below). Pointer events can't tell, since a
      // wheel zoom or a drag's inertia ends without one.
      m.on('moveend', () => {
        syncView();
        if (ours.current) {
          ours.current = false;
          return;
        }
        const b = m.getBounds();
        latest.current.onViewportChange(viewportFrom(m.getCenter(), [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], m.getZoom()));
      });
      // Once the map settles (after a move, new tiles or new dots), the areas it now shows.
      m.on('idle', syncAreas);
      // The style loads (and loads again on a scheme change) without our dots: add them each time.
      m.on('style.load', () => addDots(m, dots.current, drawn.current));
      // A dot opens its bar like a pin does; anywhere else clears the selection.
      m.on('click', (e) => {
        const f: MapGeoJSONFeature | undefined = m.getLayer(DOTS) ? m.queryRenderedFeatures(e.point, { layers: [DOTS] })[0] : undefined;
        const id = f?.properties?.id;
        latest.current.onSelect(typeof id === 'string' ? id : null);
      });
      m.on('mouseenter', DOTS, () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', DOTS, () => (m.getCanvas().style.cursor = ''));
      map.current = m;
      syncView();
      syncMe();
    });
    return () => {
      cancelled = true;
      for (const { marker } of all.values()) marker.remove();
      all.clear();
      for (const marker of shown.markers) marker.remove();
      map.current?.remove();
      map.current = null;
    };
    // The map is made once; scheme and camera changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    map.current?.setStyle(MAP_STYLE[scheme]);
    if (map.current) styleControls(map.current.getContainer(), scheme);
  }, [scheme]);

  useEffect(() => {
    const m = map.current;
    if (!camera || !m) return;
    const c = m.getCenter();
    const same = Math.abs(c.lat - camera.latitude) < 1e-6 && Math.abs(c.lng - camera.longitude) < 1e-6 && Math.abs(m.getZoom() - camera.zoom) < 0.01;
    if (same) return; // no move, so no moveend to swallow
    ours.current = true;
    m.easeTo({ center: [camera.longitude, camera.latitude], zoom: camera.zoom, duration: 500 });
  }, [camera]);

  useEffect(syncMe, [me?.latitude, me?.longitude]);

  // Every bar as a dot (and so in the areas), only when the bars change.
  useEffect(() => {
    dots.current = dotsOf(pins);
    (map.current?.getSource(DOTS) as GeoJSONSource | undefined)?.setData(dots.current);
  }, [pins]);

  // Only when what's pinned changes: moving every marker's styles on each render was most of the cost.
  useEffect(syncPins, [pins, selectedId, accent.fill, accent.text]);

  return <View ref={host} style={[styles.fill, style]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 240 },
});
