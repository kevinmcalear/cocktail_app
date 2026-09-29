import 'maplibre-gl/dist/maplibre-gl.css';

import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { DsText } from '@/components/ds';
import { backbar, fontFamilies, radius, space, type } from '@/constants/tokens';
import { pinLabel, type MapPin } from '@/lib/discoverMap';

import type { DiscoverMapProps } from './DiscoverMap';

export const mapAvailable = true;

// OpenFreeMap: free, no key, OpenStreetMap data. Muted base maps so the pins
// and the drink photos carry the colour, in both schemes.
const STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

type MapLibre = typeof import('maplibre-gl');

/** Pin heights, and the logo inside one. */
const PIN = { dot: 18, logo: 26, pill: 30 };

/**
 * A pin: the bar's logo (when it has one) and its score in a pill, or a dot
 * while early. Ink by default, the accent when selected.
 */
function paintPin(el: HTMLElement, pin: MapPin, selected: boolean, accent: DiscoverMapProps['accent']) {
  const label = pinLabel(pin);
  // Only rebuild what's inside when it changes, so logos don't reload on every render.
  const key = `${pin.logo ?? ''}|${label}`;
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    const parts: (HTMLElement | string)[] = [];
    if (pin.logo) {
      const img = document.createElement('img');
      img.src = pin.logo;
      img.alt = '';
      Object.assign(img.style, { width: `${PIN.logo}px`, height: `${PIN.logo}px`, borderRadius: `${radius.pill}px`, objectFit: 'cover', background: backbar.light.surface });
      parts.push(img);
    }
    if (label) parts.push(label);
    el.replaceChildren(...parts);
  }
  // Buttons size to their border edge, so a lone logo needs room for its 2px ring.
  const size = label ? PIN.pill : pin.logo ? PIN.logo + 4 : PIN.dot;
  el.setAttribute('aria-label', `${pin.name}${label ? `, score ${label}` : ', early'}`);
  el.setAttribute('aria-pressed', String(selected));
  Object.assign(el.style, {
    minWidth: label ? '44px' : `${size}px`,
    height: `${size}px`,
    padding: label ? `0 ${space.sm}px 0 ${pin.logo ? 2 : space.sm}px` : '0',
    gap: `${space.xs}px`,
    borderRadius: `${radius.pill}px`,
    border: `2px solid ${selected ? accent.fill : backbar.dark.ink}`,
    background: selected ? accent.fill : pin.score === null ? backbar.light.muted : backbar.light.ink,
    color: selected ? accent.text : backbar.dark.ink,
    font: `${type.caption.fontSize}px ${fontFamilies.monoMedium}, ui-monospace, monospace`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: selected ? '2' : '1',
  });
}

/**
 * The web map: MapLibre GL, loaded only in the browser (never in the static
 * render, and never in native bundles), with OpenFreeMap tiles and HTML pins.
 */
export function DiscoverMap({ pins, selectedId, onSelect, onViewportChange, camera, scheme, accent, compact, style }: DiscoverMapProps) {
  const host = useRef<View>(null);
  const map = useRef<MapLibreMap | null>(null);
  const lib = useRef<MapLibre | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>());
  // Set while the map is moving because we moved it.
  const ours = useRef(false);
  const latest = useRef({ onSelect, onViewportChange, pins, selectedId, accent, camera });
  useEffect(() => {
    latest.current = { onSelect, onViewportChange, pins, selectedId, accent, camera };
  });

  const syncPins = () => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml) return;
    const { pins: now, selectedId: sel, accent: acc } = latest.current;
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
    void import('maplibre-gl').then((ml) => {
      const container = host.current as unknown as HTMLElement | null;
      if (cancelled || !container) return;
      lib.current = ml;
      const start = latest.current.camera;
      const m = new ml.Map({
        container,
        style: STYLE[scheme],
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
        const c = m.getCenter();
        latest.current.onViewportChange({
          latitude: c.lat,
          longitude: c.lng,
          latitudeDelta: b.getNorth() - b.getSouth(),
          longitudeDelta: b.getEast() - b.getWest(),
        });
      });
      m.on('click', () => latest.current.onSelect(null));
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
    map.current?.setStyle(STYLE[scheme]);
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

  useEffect(syncPins);

  return <View ref={host} style={[styles.fill, style]} />;
}

/** The tile and data credit, for when the map is too small to show it (phones, in the sheet). */
export function MapCredit() {
  return (
    <DsText variant="caption" tone="muted" role="link" onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>
      Map by OpenFreeMap · © OpenMapTiles · data © OpenStreetMap contributors
    </DsText>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 240 },
});
