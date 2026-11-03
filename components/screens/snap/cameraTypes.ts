import type { ReadFile } from '@/lib/readAnything';

/** starting: asking or opening; live: showing; off: the person said no (or Settings did); failed: no camera to open. */
export type CameraState = 'starting' | 'live' | 'off' | 'failed';

export interface LiveCameraHandle {
  /** Takes the photo. Null when there was nothing to take. */
  snap: () => Promise<ReadFile | null>;
}
