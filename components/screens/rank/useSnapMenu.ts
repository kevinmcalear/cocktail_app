import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { useToast } from '@/components/ds';
import { useStartBringIn } from '@/components/screens/bringin/useStartBringIn';
import { snapReadFiles, sourcesFromFiles } from '@/lib/readAnything';

/**
 * "Snap the menu" in Rank it: the camera, then Bring in reads the page as a
 * menu (the app's menu-from-a-photo flow) into your home bar. Null where
 * there's no camera: the simulator has none, and launching it there crashes.
 */
export function useSnapMenu(): (() => void) | null {
  const start = useStartBringIn();
  const toast = useToast();
  if (Platform.OS !== 'web' && !Device.isDevice) return null;
  return () => {
    // Called straight from the tap: the web's file input opens only from one.
    void snapReadFiles()
      .then(async (files) => {
        if (files.length) start(await sourcesFromFiles(files), { barId: null, hint: 'menu' });
      })
      .catch((e: unknown) => toast.show({ title: 'Couldn’t open the camera', detail: e instanceof Error ? e.message : undefined }));
  };
}
