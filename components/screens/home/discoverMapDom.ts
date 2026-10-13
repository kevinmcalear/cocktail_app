// The web map's HTML bits (DiscoverMap.web.tsx): its stylesheet, the score
// pins and the area labels. Plain DOM, since MapLibre GL markers take elements.
import { backbar, fontFamilies, radius, space, type } from '@/constants/tokens';
import { areaLook, pinDescription, pinLook, type MapArea, type MapPin } from '@/lib/discoverMap';
import { knownLogoEdge, lookAtLogoEdge, type KnownEdge } from '@/lib/logoEdge';

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

/**
 * A pin's logo as LogoImage draws it: on a flat logo's own colour, fitted
 * inside it so its edge blends; a transparent one or one that can't be read on
 * the white disc pins have always had.
 */
function paintLogo(img: HTMLImageElement, edge: KnownEdge, size: number) {
  const solid = edge?.kind === 'solid';
  Object.assign(img.style, {
    visibility: edge === undefined ? 'hidden' : 'visible',
    objectFit: solid || edge?.kind === 'clear' ? 'contain' : 'cover',
    padding: solid ? `${Math.round(size * 0.1)}px` : '0',
    background: solid ? edge.color : edge?.kind === 'busy' ? 'transparent' : backbar.light.surface,
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
      const logo = look.logo;
      img.src = logo;
      img.alt = '';
      Object.assign(img.style, {
        width: `${look.logoSize}px`,
        height: `${look.logoSize}px`,
        borderRadius: `${radius.pill}px`,
        boxSizing: 'border-box',
      });
      paintLogo(img, knownLogoEdge(logo), look.logoSize);
      // An older logo's edge is read once (lib/logoEdge); until then it's hidden, so it never jumps.
      if (knownLogoEdge(logo) === undefined) void lookAtLogoEdge(logo).then((edge) => el.dataset.key === key && paintLogo(img, edge, look.logoSize));
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
    font: `${look.fontSize}px ${fontFamilies[look.font]}, ${look.font === 'monoMedium' ? 'ui-monospace, monospace' : 'system-ui, sans-serif'}`,
    whiteSpace: 'nowrap',
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


/**
 * MapLibre's zoom buttons and credit as drawn (disc-desk-browse): a glass column of 40-point buttons top
 * right, and the credit (kept in full, OpenStreetMap asks for it) as muted caption text bottom right.
 */
export function styleControls(container: HTMLElement, scheme: 'light' | 'dark') {
  const c = backbar[scheme];
  container.classList.add('discover-map');
  for (const [k, v] of Object.entries({ glass: c.glass, edge: c.glassBorder, muted: c.muted, icon: scheme === 'dark' ? 'invert(1)' : 'none' })) container.style.setProperty(`--dm-${k}`, v);
  if (document.getElementById('discover-map-css')) return;
  const css = document.createElement('style');
  css.id = 'discover-map-css';
  const m = '.discover-map .maplibregl-ctrl';
  css.textContent = `${m}-top-right .maplibregl-ctrl { margin: ${space.lg}px ${space.lg}px 0 0; }
${m}-group { background: var(--dm-glass); border: 1px solid var(--dm-edge); border-radius: ${radius.control}px; box-shadow: none; overflow: hidden; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
${m}-group button { width: 40px; height: 40px; background-color: transparent; }
${m}-group button + button { border-top: 1px solid var(--dm-edge); }
${m}-group button:not(:disabled):hover { background-color: var(--dm-edge); }
${m}-icon { filter: var(--dm-icon); }
${m}-bottom-right .maplibregl-ctrl-attrib { margin: 0 ${space.md}px ${space.sm + 2}px 0; padding: 0; background: transparent; font: ${type.caption.fontSize}px/${type.caption.lineHeight}px ${fontFamilies.body}, system-ui, sans-serif; color: var(--dm-muted); }
${m}-attrib a { color: inherit; }`;
  document.head.appendChild(css);
}
