import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { useStartBringIn } from '@/components/screens/bringin/useStartBringIn';
import { hasLiveCamera } from '@/components/screens/snap/LiveCamera';
import { useBringInPlace } from '@/hooks/useBringInPlace';
import { addIntent } from '@/lib/addIntent';
import { peekClipboard, readClipboardAny, UNREAD_CLIP } from '@/lib/clipboardPeek';
import { newDrinkHref } from '@/lib/itemRoutes';
import { pickReadFiles, snapReadFiles, sourcesFromFiles, type ReadFile } from '@/lib/readAnything';
import { capitalizeFirst } from '@/lib/stringUtils';

/**
 * What Add does, for the iOS and web sheet and Android's FAB menu: a typed
 * name opens a draft in pencil, anything else (a link, a pasted spec, a
 * description, a photo, a PDF) goes to Bring in, which reads it. All of it
 * lands where Bring in puts things (useBringInPlace). `done` runs first, to
 * close the sheet or menu. `replace` swaps the page it's on for where it goes
 * (the viewfinder, which is a page of its own).
 */
export function useAddActions(done: () => void, { replace = false }: { replace?: boolean } = {}) {
  const router = useRouter();
  const place = useBringInPlace();
  const start = useStartBringIn();
  const [error, setError] = useState<string | null>(null);
  const into = { barId: place.barId, ...(replace ? { replace } : null) };

  const read = (text: string) => {
    done();
    start([{ files: [], text, url: null }], into);
  };
  const fromFiles = async (get: () => Promise<ReadFile[]>) => {
    setError(null);
    try {
      const files = await get();
      if (!files.length) return;
      const sources = await sourcesFromFiles(files);
      done();
      start(sources, into);
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
      // Before the place is known, the link names no bar and the wizard waits for it.
      const href = newDrinkHref(capitalizeFirst(text.trim()), place.loading ? undefined : place.barId) as never;
      if (replace) router.replace(href);
      else router.push(href);
    },
    /**
     * Snap (Prod-add-flow 1): our viewfinder where the build has the camera
     * module (or the browser can show one); builds from before it, and
     * browsers without, open the system camera or file chooser as before.
     */
    snap: async () => {
      if (!(await hasLiveCamera())) return void fromFiles(snapReadFiles);
      done();
      router.push('/snap' as never);
    },
    choose: () => void fromFiles(pickReadFiles),
    /** Reads a photo the viewfinder took. */
    photo: (file: ReadFile) => fromFiles(async () => [file]),
    /** Reads what's on the clipboard: text, or a picture when there's no text (iOS asks first and Android announces it, so it's only read on this tap). */
    paste: async () => {
      const clip = await readClipboardAny();
      if (!clip) return setError('Nothing copied yet.');
      if ('image' in clip) return fromFiles(async () => [clip.image]);
      read(clip.text);
    },
  };
}

/** What's on the clipboard, for Add to offer: UNREAD_CLIP on phones (unread until a tap), the text on the web, or null. */
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
