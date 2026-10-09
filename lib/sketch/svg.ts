// A painted scene as an SVG document, for drawing a sketch outside the app
// (the shared menu's link preview, api/menu-og.ts). The same shapes, fills
// and gradients as components/ds/SketchDrawing, written as markup.

import type { Scene, SceneEl } from './scene';

const stops = (color: string, fadeTo: number) =>
  `<stop offset="0" stop-color="${color}" stop-opacity="1"/><stop offset="0.45" stop-color="${color}" stop-opacity="0.92"/><stop offset="1" stop-color="${color}" stop-opacity="${fadeTo}"/>`;

function defs(els: SceneEl[], out: string[]): string[] {
  for (const el of els) {
    if (el.k === 'wash') {
      const [x1, y1, x2, y2] = el.grad;
      const line = `gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
      out.push(`<linearGradient id="${el.id}f" ${line}>${stops(el.color, el.fadeTo)}</linearGradient>`, `<linearGradient id="${el.id}e" ${line}>${stops(el.edge, el.fadeTo)}</linearGradient>`);
    } else if (el.k === 'soft') {
      out.push(
        `<radialGradient id="${el.id}"><stop offset="0" stop-color="${el.color}" stop-opacity="1"/><stop offset="0.6" stop-color="${el.color}" stop-opacity="0.55"/><stop offset="1" stop-color="${el.color}" stop-opacity="0"/></radialGradient>`,
      );
    } else if (el.k === 'group') {
      out.push(`<clipPath id="${el.id}"><path d="${el.clip}"/></clipPath>`);
      defs(el.children, out);
    } else if (el.k === 'stage') {
      defs(el.children, out);
    }
  }
  return out;
}

function draw(el: SceneEl): string {
  switch (el.k) {
    case 'fill':
      return `<path d="${el.d}" fill="${el.color}" fill-opacity="${el.o}"/>`;
    case 'stroke':
      return `<path d="${el.d}" fill="none" stroke="${el.color}" stroke-opacity="${el.o}" stroke-width="${el.w}" stroke-linecap="round" stroke-linejoin="round"${el.dash ? ` stroke-dasharray="${el.dash}"` : ''}/>`;
    case 'wash':
      return `<g>${el.ds.map((d) => `<path d="${d}" fill="url(#${el.id}f)" fill-opacity="${el.o}" stroke="url(#${el.id}e)" stroke-opacity="${el.edgeO}" stroke-width="${el.edgeW}"/>`).join('')}</g>`;
    case 'soft':
      return `<ellipse cx="${el.cx}" cy="${el.cy}" rx="${el.rx}" ry="${el.ry}" fill="url(#${el.id})" opacity="${el.o}" transform="rotate(${(el.rot * 180) / Math.PI} ${el.cx} ${el.cy})"/>`;
    case 'group':
      return `<g clip-path="url(#${el.id})">${el.children.map(draw).join('')}</g>`;
    case 'stage':
      return `<g>${el.children.map(draw).join('')}</g>`;
  }
}

/** The scene as a standalone SVG, `size` pixels square. With `paper`, on that colour; without, transparent. */
export function sceneToSvg(scene: Scene, { size = scene.size, paper }: { size?: number; paper?: string } = {}): string {
  const ground = paper ? `<rect x="0" y="0" width="${scene.size}" height="${scene.size}" fill="${paper}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${scene.size} ${scene.size}">${ground}<defs>${defs(scene.els, []).join('')}</defs>${scene.els.map(draw).join('')}</svg>`;
}
