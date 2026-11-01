// The web's picture of a page: the page's DOM drawn at POSTER_PIXELS wide
// (modern-screenshot, as the Feedback button's screenshot), fonts and drawings
// included. Loaded only when someone saves or shares. Same exports as picture.ts.
import type { ComponentRef } from 'react';
import type { View } from 'react-native';

import { POSTER_PIXELS, type PaperPage } from './page';

export type PictureResult = 'saved' | 'shared' | 'cancelled';

const fileName = (title: string, page: PaperPage) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poster'}-${page.w === page.h ? 'square' : 'story'}.png`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Saves the picture as a file, or hands it to the browser's share sheet
 * where it takes files (phones); a desktop browser without one saves it.
 * Throws when the picture can't be made.
 */
export async function sendPicture(view: ComponentRef<typeof View>, page: PaperPage, action: 'save' | 'share', title: string): Promise<PictureResult> {
  const node = view as unknown as HTMLElement;
  const { domToBlob } = await import('modern-screenshot');
  // The preview is scaled down around it; the picture is drawn at the page's own size (offset sizes ignore the scale), POSTER_PIXELS wide.
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const blob = await domToBlob(node, { type: 'image/png', width, height, scale: POSTER_PIXELS / width });
  const name = fileName(title, page);
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
