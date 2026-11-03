import { requireOptionalNativeModule } from 'expo';
import type { ComponentRef } from 'react';
import { Share, type View } from 'react-native';

import { optionalNative } from '@/lib/optionalNative';

/** What happened: saved to Photos, handed to the share sheet, or closed without picking anything. */
export type PictureResult = 'saved' | 'shared' | 'cancelled';

// Phones: the page's view as a PNG file (react-native-view-shot), at its own size. It's laid out POSTER_PIXELS device pixels wide (PosterScreen), so the picture is too.
async function takePicture(view: ComponentRef<typeof View>): Promise<string> {
  const { captureRef } = await import('react-native-view-shot');
  return captureRef(view, { format: 'png', result: 'tmpfile' });
}

/** Phones take the picture on the tap; only the web has to draw it ahead (picture.web.ts). */
export function preparePicture(_view: ComponentRef<typeof View>): void {}

async function shareFile(uri: string, title: string): Promise<void> {
  // Builds before expo-sharing get the system sheet with the file (iOS reads `url`).
  if (!requireOptionalNativeModule('ExpoSharing')) {
    await Share.share({ url: uri, title });
    return;
  }
  const Sharing = await import('expo-sharing');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
}

/**
 * Makes the picture of a page drawn by components/paper/PaperPage and saves
 * it to Photos or opens the share sheet with it. Save asks only to add photos
 * (never to read them); a build without expo-media-library, or a refusal,
 * opens the share sheet instead, which has Save Image. Throws when the
 * picture can't be made.
 */
export async function sendPicture(view: ComponentRef<typeof View>, action: 'save' | 'share', title: string): Promise<PictureResult> {
  const uri = await takePicture(view);
  if (action === 'save') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const library = optionalNative('ExpoMediaLibrary', () => require('expo-media-library/legacy') as typeof import('expo-media-library/legacy'));
    if (library) {
      try {
        const asked = await library.requestPermissionsAsync(true, ['photo']);
        if (asked.granted) {
          await library.saveToLibraryAsync(uri);
          return 'saved';
        }
      } catch {
        // Android without the old storage permission (blocked in app.json): the share sheet saves it instead.
      }
    }
  }
  await shareFile(uri, title);
  return 'shared';
}
