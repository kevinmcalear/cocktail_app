import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { useEffect, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { backbar, fontFamilies, radius, type } from '@/constants/tokens';
import { MAP_STYLE, pinDescription, pinLook, viewportFrom, type MapPin } from '@/lib/discoverMap';

import type { DiscoverMapProps } from './DiscoverMap';

export const mapAvailable = true;

type MapLibre = typeof import('maplibre-gl');

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
  const host = useRef<ComponentRef<typeof View>>(null);
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
    void Promise.all([import('maplibre-gl'), loadMapStyles()]).then(([ml]) => {
      const container = host.current as unknown as HTMLElement | null;
      if (cancelled || !container) return;
      lib.current = ml;
      const start = latest.current.camera;
      const m = new ml.Map({
        container,
        style: MAP_STYLE[scheme],
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

  useEffect(syncPins);

  return <View ref={host} style={[styles.fill, style]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 240 },
});
