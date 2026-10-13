// The web map's HTML bits (DiscoverMap.web.tsx): its stylesheet, the score
// pins and the area labels. Plain DOM, since MapLibre GL markers take elements.
import { backbar, fontFamilies, radius, type } from '@/constants/tokens';
import { areaLook, pinDescription, pinLook, type MapArea, type MapPin } from '@/lib/discoverMap';

import type { DiscoverMapProps } from './DiscoverMap';

/**
 * Maplibre's stylesheet, loaded with the map. A static CSS import made Expo
 * link it, render-blocking, on every page. ponytail: public/maplibre-gl.css is
 * a copy of the installed one; scripts/maplibreCss.check.ts keeps them equal.
 */
export function loadMapStyles(): Promise<void> {
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
export function paintPin(el: HTMLElement, pin: MapPin, selected: boolean, accent: DiscoverMapProps['accent']) {
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
    border: `${look.borderWidth}px solid ${look.borderColor}`,
    boxShadow: look.boxShadow,
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

/** An area's label (disc-map-opt-d): "9.1 · 24 bars" on the score pins' dark pill. */
export function areaElement(area: MapArea, onPress: () => void): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = area.label;
  el.setAttribute('aria-label', `${area.label}. Zoom in to see each bar`);
  Object.assign(el.style, {
    height: `${areaLook.height}px`,
    padding: `0 ${areaLook.paddingHorizontal}px`,
    borderRadius: `${radius.pill}px`,
    border: `1px solid ${areaLook.borderColor}`,
    boxShadow: areaLook.boxShadow,
    background: areaLook.backgroundColor,
    color: areaLook.color,
    font: `${type.caption.fontSize}px ${fontFamilies.monoMedium}, ui-monospace, monospace`,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  });
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onPress();
  });
  return el;
}

