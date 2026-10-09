import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature, Marker } from 'maplibre-gl';
import { useEffect, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { backbar, fontFamilies, radius, type } from '@/constants/tokens';
import { dotsOf, MAP_STYLE, pinDescription, pinLook, viewportFrom, type MapPin } from '@/lib/discoverMap';

import type { DiscoverMapProps } from './DiscoverMap';

export const mapAvailable = true;

type MapLibre = typeof import('maplibre-gl');

/**
 * Pins drawn as HTML (logo, score), best first. Past these (and the selected
 * one) the rest are labelled dots the map draws itself, clustered when they
 * crowd: hundreds of HTML markers, each moved every frame, made panning slow.
 */
const RICH_PINS = 40;
const DOTS = 'discover-dots';
const DOT_LAYERS = ['discover-clusters', 'discover-dots', 'discover-dot-labels'];

/** The dots source and its layers (the same look as the native map's), added again after a style change wipes them. */
function addDots(m: MapLibreMap, data: GeoJSON.FeatureCollection) {
  if (m.getSource(DOTS)) return;
  const ink = backbar.light.ink;
  const ring = backbar.dark.ink;
  const text = { 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true };
  m.addSource(DOTS, { type: 'geojson', data, cluster: true, clusterRadius: 44 });
  m.addLayer({ id: 'discover-clusters', type: 'circle', source: DOTS, filter: ['has', 'point_count'], paint: { 'circle-color': ring, 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 17, 50, 21], 'circle-stroke-color': ink, 'circle-stroke-width': 2 } });
  m.addLayer({ id: 'discover-cluster-counts', type: 'symbol', source: DOTS, filter: ['has', 'point_count'], layout: { ...text, 'text-field': ['get', 'point_count_abbreviated'], 'text-size': type.caption.fontSize }, paint: { 'text-color': ink } });
  m.addLayer({ id: 'discover-dots', type: 'circle', source: DOTS, filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ink, 'circle-radius': ['case', ['==', ['get', 'label'], ''], 6, 13], 'circle-stroke-color': ring, 'circle-stroke-width': 2 } });
  m.addLayer({ id: 'discover-dot-labels', type: 'symbol', source: DOTS, filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'label'], '']], layout: { ...text, 'text-field': ['get', 'label'], 'text-size': type.caption.fontSize - 1 }, paint: { 'text-color': ring } });
}

/**
 * Maplibre's stylesheet, loaded with the map. A static CSS import made Expo
 * link it, render-blocking, on every page. ponytail: public/maplibre-gl.css is
 * a copy of the installed one; scripts/maplibreCss.check.ts keeps them equal.
 */
function loadMapStyles(): Promise<void> {
  const id = 'maplibre-gl-css';
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = '/maplibre-gl.css';
    // A failed load still shows the map, just unstyled; don't hold it back.
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

/** Paints a pin's HTML element with the look both maps share (lib/discoverMap pinLook). */
function paintPin(el: HTMLElement, pin: MapPin, selected: boolean, accent: DiscoverMapProps['accent']) {
  const look = pinLook(pin, selected, accent);
  // Only rebuild what's inside when it changes, so logos don't reload on every render.
  const key = `${look.logo ?? ''}|${look.label}`;
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    const parts: (HTMLElement | string)[] = [];
    if (look.logo) {
      const img = document.createElement('img');
      img.src = look.logo;
      img.alt = '';
      Object.assign(img.style, {
        width: `${look.logoSize}px`,
        height: `${look.logoSize}px`,
        borderRadius: `${radius.pill}px`,
        objectFit: 'cover',
        background: backbar.light.surface,
      });
      parts.push(img);
    }
    if (look.label) parts.push(look.label);
    el.replaceChildren(...parts);
  }
  el.setAttribute('aria-label', pinDescription(pin));
  el.setAttribute('aria-pressed', String(selected));
  Object.assign(el.style, {
    minWidth: `${look.minWidth}px`,
    height: `${look.height}px`,
    padding: `0 ${look.paddingRight}px 0 ${look.paddingLeft}px`,
    gap: `${look.gap}px`,
    borderRadius: `${radius.pill}px`,
    border: `2px solid ${look.borderColor}`,
    background: look.backgroundColor,
    color: look.color,
    opacity: String(look.opacity),
    font: `${type.caption.fontSize}px ${fontFamilies.monoMedium}, ui-monospace, monospace`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: String(look.zIndex),
  });
}

/**
 * The web map: MapLibre GL, loaded only in the browser (never in the static
 * render, and never in native bundles), with OpenFreeMap tiles and HTML pins.
 */
export function DiscoverMap({ pins, selectedId, onSelect, onViewportChange, camera, scheme, accent, compact, style }: DiscoverMapProps) {
  const host = useRef<ComponentRef<typeof View>>(null);
  const map = useRef<MapLibreMap | null>(null);
  const lib = useRef<MapLibre | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>());
  const dots = useRef<GeoJSON.FeatureCollection>(dotsOf([]));
  // Set while the map is moving because we moved it.
  const ours = useRef(false);
  const latest = useRef({ onSelect, onViewportChange, pins, selectedId, accent, camera, scheme });
  useEffect(() => {
    latest.current = { onSelect, onViewportChange, pins, selectedId, accent, camera, scheme };
  });

  const syncPins = () => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml) return;
    const { pins: all, selectedId: sel, accent: acc } = latest.current;
    const now = all.filter((p, i) => i < RICH_PINS || p.id === sel);
    dots.current = dotsOf(all.filter((p, i) => i >= RICH_PINS && p.id !== sel));
    (m.getSource(DOTS) as GeoJSONSource | undefined)?.setData(dots.current);
    const keep = new Set(now.map((p) => p.id));
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

  // Create the map once, in the browser.
  useEffect(() => {
    let cancelled = false;
    const all = markers.current;
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
      // Only the person's own moves count for "search this area": every move
      // but the ones we start (below). Pointer events can't tell, since a
      // wheel zoom or a drag's inertia ends without one.
      m.on('moveend', () => {
        if (ours.current) {
          ours.current = false;
          return;
        }
        const b = m.getBounds();
        latest.current.onViewportChange(viewportFrom(m.getCenter(), [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]));
      });
      // The style loads (and loads again on a scheme change) without our dots: add them each time.
      m.on('style.load', () => addDots(m, dots.current));
      // A dot opens its bar; a cluster zooms in until it comes apart; anywhere else clears the selection.
      m.on('click', (e) => {
        const f: MapGeoJSONFeature | undefined = m.getLayer(DOT_LAYERS[0]) ? m.queryRenderedFeatures(e.point, { layers: DOT_LAYERS })[0] : undefined;
        const props = f?.properties ?? {};
        if (props.cluster && f?.geometry.type === 'Point') {
          const [lng, lat] = f.geometry.coordinates;
          void (m.getSource(DOTS) as GeoJSONSource).getClusterExpansionZoom(props.cluster_id).then((zoom) => {
            ours.current = true;
            m.easeTo({ center: [lng, lat], zoom, duration: 400 });
          });
        } else latest.current.onSelect(typeof props.id === 'string' ? props.id : null);
      });
      for (const id of DOT_LAYERS) {
        m.on('mouseenter', id, () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', id, () => (m.getCanvas().style.cursor = ''));
      }
      map.current = m;
      syncPins();
    });
    return () => {
      cancelled = true;
      for (const { marker } of all.values()) marker.remove();
      all.clear();
      map.current?.remove();
      map.current = null;
    };
    // The map is made once; scheme and camera changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    map.current?.setStyle(MAP_STYLE[scheme]);
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

  // Only when what's pinned changes: moving every marker's styles on each render was most of the cost.
  useEffect(syncPins, [pins, selectedId, accent.fill, accent.text]);

  return <View ref={host} style={[styles.fill, style]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 240 },
});
