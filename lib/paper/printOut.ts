import type { ComponentRef } from 'react';
import type { View } from 'react-native';

import { optionalNative } from '@/lib/optionalNative';

import { PAPER, type Paper } from './page';
import { sendPicture } from './picture';
import { pagesHtml, printPixels } from './printHtml';

export type PrintResult = 'printed' | 'shared' | 'cancelled';

/**
 * Prints drawn pages (components/paper/PaperPage) on a phone: a picture of
 * each, one to a sheet, in the system print sheet, which also saves a PDF
 * and shares. A build without expo-print shares a picture of the first page.
 */
export async function printPages(views: ComponentRef<typeof View>[], paper: Paper, title: string): Promise<PrintResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = optionalNative('ExpoPrint', () => require('expo-print') as typeof import('expo-print'));
  if (!Print) {
    if (!views[0]) return 'cancelled';
    await sendPicture(views[0], 'share', title);
    return 'shared';
  }
  const { captureRef } = await import('react-native-view-shot');
  const { w, h } = PAPER[paper];
  const width = printPixels(paper);
  const pictures: string[] = [];
  for (const view of views) pictures.push(await captureRef(view, { format: 'png', result: 'data-uri', width, height: Math.round((width * h) / w) }));
  try {
    await Print.printAsync({ html: pagesHtml(pictures, paper, title), width: w * 72, height: h * 72 });
    return 'printed';
  } catch {
    // Closing the print sheet without printing rejects on some builds.
    return 'cancelled';
  }
}
