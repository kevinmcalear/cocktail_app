/**
 * Pictures of drawn pages (components/paper/PaperPage) as one printable
 * HTML document: each picture fills a sheet of its paper, one to a sheet.
 * Phones hand it to expo-print, the web prints it in a hidden frame, so
 * every platform prints exactly what the preview shows, faces and drawings
 * included. Pure.
 */

import { PAPER, type Paper } from './page';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Only pictures this app made: PNG or JPEG data URIs. */
const isPicture = (src: string) => /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(src);

export function pagesHtml(pictures: readonly string[], paper: Paper, title: string): string {
  const { w, h } = PAPER[paper];
  const imgs = pictures.filter(isPicture).map((src) => `<img src="${src}" alt="">`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { size: ${w}in ${h}in; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
img { display: block; width: ${w}in; height: ${h}in; break-after: page; page-break-after: always; }
img:last-child { break-after: auto; page-break-after: auto; }
</style></head><body>${imgs.join('')}</body></html>`;
}

/** Pixels across a picture of one page: enough for print (about 200 dots an inch), small enough to send. */
export const printPixels = (paper: Paper) => Math.round(PAPER[paper].w * 200);
