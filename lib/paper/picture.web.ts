// The web's picture of a page: the page's DOM drawn at POSTER_PIXELS wide
// (modern-screenshot, as the Feedback button's screenshot), fonts and drawings
// included. Loaded only when someone saves or shares. Same exports as picture.ts.
import type { ComponentRef } from 'react';
import type { View } from 'react-native';

import { POSTER_PIXELS } from './page';

export type PictureResult = 'saved' | 'shared' | 'cancelled';

type PageView = ComponentRef<typeof View>;

const fileName = (title: string, node: HTMLElement) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poster'}-${node.offsetWidth === node.offsetHeight ? 'square' : 'story'}.png`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function drawPicture(view: PageView): Promise<Blob> {
  const node = view as unknown as HTMLElement;
  const { domToBlob } = await import('modern-screenshot');
  // The preview is scaled down around it; the picture is drawn at the page's own size (offset sizes ignore the scale), POSTER_PIXELS wide.
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  return domToBlob(node, { type: 'image/png', width, height, scale: POSTER_PIXELS / width });
}

let prepared: { view: PageView; blob: Promise<Blob> } | null = null;

/**
 * Draws the picture ahead of the tap, once the page has painted: a browser
 * opens its share sheet only straight after a tap, and drawing takes longer
 * than that allows. Browsers with no share sheet draw on the tap instead.
 */
export function preparePicture(view: PageView): void {
  if (typeof navigator.canShare !== 'function') return;
  const blob = drawPicture(view);
  // A failure here is seen again, and reported, on the tap.
  blob.catch(() => undefined);
  prepared = { view, blob };
}

/**
 * Saves the picture as a file, or hands it to the browser's share sheet
 * where it takes files (phones); a browser without one, or one that refuses,
 * saves it. Throws when the picture can't be made.
 */
export async function sendPicture(view: PageView, action: 'save' | 'share', title: string): Promise<PictureResult> {
  const ahead = prepared?.view === view ? prepared.blob : null;
  const blob = ahead ? await ahead.catch(() => drawPicture(view)) : await drawPicture(view);
  const name = fileName(title, view as unknown as HTMLElement);
  const file = new File([blob], name, { type: 'image/png' });
  if (action === 'share' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, name);
  return 'saved';
}
