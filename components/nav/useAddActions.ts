import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { useStartBringIn } from '@/components/screens/bringin/useStartBringIn';
import { useBringInPlace } from '@/hooks/useBringInPlace';
import { addIntent } from '@/lib/addIntent';
import { peekClipboard, readClipboard, UNREAD_CLIP } from '@/lib/clipboardPeek';
import { newDrinkHref } from '@/lib/itemRoutes';
import { pickReadFiles, snapReadFiles, sourcesFromFiles, type ReadFile } from '@/lib/readAnything';
import { capitalizeFirst } from '@/lib/stringUtils';

/**
 * What Add does, for the iOS and web sheet and Android's FAB menu: a typed
 * name opens a draft in pencil, anything else (a link, a pasted spec, a
 * description, a photo, a PDF) goes to Bring in, which reads it. All of it
 * lands where Bring in puts things (useBringInPlace). `done` runs first, to
 * close the sheet or menu.
 */
export function useAddActions(done: () => void) {
  const router = useRouter();
  const place = useBringInPlace();
  const start = useStartBringIn();
  const [error, setError] = useState<string | null>(null);

  const read = (text: string) => {
    done();
    start([{ files: [], text, url: null }], { barId: place.barId });
  };
  const fromFiles = async (get: () => Promise<ReadFile[]>) => {
    setError(null);
    try {
      const files = await get();
      if (!files.length) return;
      const sources = await sourcesFromFiles(files);
      done();
      start(sources, { barId: place.barId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t open your photos.');
    }
  };

  return {
    place,
    error,
    // The simulator has no camera, and launching it there crashes the app.
    canSnap: Platform.OS === 'web' || Device.isDevice,
    submit: (text: string) => {
      const intent = addIntent(text);
      if (intent === 'read') return read(text.trim());
      if (intent !== 'name') return;
      done();
      router.push(newDrinkHref(capitalizeFirst(text.trim()), place.barId) as never);
    },
    snap: () => void fromFiles(snapReadFiles),
    choose: () => void fromFiles(pickReadFiles),
    /** Reads what's on the clipboard (iOS asks first, so it's only read on this tap). */
    paste: async () => {
      const text = await readClipboard();
      if (text?.trim()) read(text.trim());
      else setError('Nothing copied yet.');
    },
  };
}

/** What's on the clipboard, for Add to offer: the text, UNREAD_CLIP on iOS (unread until a tap), or null. */
export function useClipboardOffer() {
  const [clip, setClip] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void peekClipboard().then((value) => live && setClip(value && (value === UNREAD_CLIP || value.trim().length > 3) ? value : null));
    return () => {
      live = false;
    };
  }, []);
  return clip;
}
