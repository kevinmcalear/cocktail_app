// The web's print: a picture of each drawn page (modern-screenshot, as the
// share poster draws its picture), one to a sheet, in a hidden frame that
// prints on its own, so the browser's dialog (and its Save as PDF) gets only
// the pages, at their paper's size. Same exports as printOut.ts.
import type { ComponentRef } from 'react';
import type { View } from 'react-native';

import { PAPER, type Paper } from './page';
import { pagesHtml, printPixels } from './printHtml';

export type PrintResult = 'printed' | 'shared' | 'cancelled';

export async function printPages(views: ComponentRef<typeof View>[], paper: Paper, title: string): Promise<PrintResult> {
  if (!views.length) return 'cancelled';
  const { domToPng } = await import('modern-screenshot');
  const { w, h } = PAPER[paper];
  const pictures: string[] = [];
  for (const view of views) {
    const node = view as unknown as HTMLElement;
    // The preview is scaled down around it; offset sizes are the page's own.
    const width = node.offsetWidth;
    pictures.push(await domToPng(node, { width, height: Math.round((width * h) / w), scale: printPixels(paper) / width }));
  }
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  frame.srcdoc = pagesHtml(pictures, paper, title);
  await new Promise<void>((resolve) => {
    frame.onload = () => resolve();
    document.body.appendChild(frame);
  });
  const win = frame.contentWindow;
  // Every picture is in before the dialog opens. A tab in the background may never decode, so it waits three seconds at most.
  const decoded = Promise.all(Array.from(frame.contentDocument?.images ?? []).map((img) => img.decode().catch(() => undefined)));
  await Promise.race([decoded, new Promise((resolve) => window.setTimeout(resolve, 3000))]);
  win?.focus();
  win?.print();
  // The dialog blocks until it's closed in most browsers; Safari returns at once, so the frame stays a while.
  window.setTimeout(() => frame.remove(), 60_000);
  return 'printed';
}
