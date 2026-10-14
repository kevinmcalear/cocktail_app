import { requireOptionalNativeModule } from 'expo';

/** A cut-out: a PNG with alpha in the cache directory, the photo's own frame. */
export interface Cutout {
  uri: string;
  width: number;
  height: number;
}

/** Why there's no cut-out: no subject found, the Android model still downloading, an older iOS, and so on. */
type Skipped = { reason: string };

interface SubjectCutoutNative {
  isSupported(): boolean;
  cutout(uri: string): Promise<Cutout | Skipped>;
}

// Optional on purpose: binaries built before this module (and the web) have
// no SubjectCutout, and this JS reaches them by update. There the option is
// simply hidden instead of crashing at load.
const native = requireOptionalNativeModule<SubjectCutoutNative>('SubjectCutout');

/** Whether this device can lift a subject out of a photo (iOS 17+ or Android with this build). */
export const cutoutAvailable: boolean = !!native && native.isSupported();

/**
 * Lifts the subject (the drink) out of the photo at `uri`, on the device.
 * Null when it can't: no native module, nothing that reads as a subject,
 * or (Android) the model not downloaded yet.
 */
export async function cutout(uri: string): Promise<Cutout | null> {
  if (!native || !cutoutAvailable) return null;
  try {
    const result = await native.cutout(uri);
    if ('reason' in result) {
      if (__DEV__) console.info(`[cutout] skipped: ${result.reason}`);
      return null;
    }
    return result;
  } catch (error) {
    if (__DEV__) console.warn('[cutout] failed', error);
    return null;
  }
}
