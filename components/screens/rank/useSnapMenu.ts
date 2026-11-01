import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { useToast } from '@/components/ds';
import { useStartBringIn } from '@/components/screens/bringin/useStartBringIn';
import { snapReadFiles, sourcesFromFiles } from '@/lib/readAnything';
import { useRankReturn } from '@/store/useRankReturn';

/**
 * "Snap the menu" in Rank it: the camera, then Bring in reads the page as a
 * menu (the app's menu-from-a-photo flow) into your home bar. Null where
 * there's no camera: the simulator has none, and launching it there crashes.
 * Resolves true once Bring in has started (Rank it comes back to the search
 * typed, `query`, when it ends), false when the camera was cancelled or failed.
 */
export function useSnapMenu(): ((query?: string) => Promise<boolean>) | null {
  const start = useStartBringIn();
  const toast = useToast();
  if (Platform.OS !== 'web' && !Device.isDevice) return null;
  // Called straight from the tap: the web's file input opens only from one.
  return (query = '') =>
    snapReadFiles()
      .then(async (files) => {
        if (!files.length) return false;
        const sources = await sourcesFromFiles(files);
        if (!sources.length) return false;
        useRankReturn.getState().begin(query);
        start(sources, { barId: null, hint: 'menu' });
        return true;
      })
      .catch((e: unknown) => {
        toast.show({ title: 'Couldn’t open the camera', detail: e instanceof Error ? e.message : undefined });
        return false;
      });
}
