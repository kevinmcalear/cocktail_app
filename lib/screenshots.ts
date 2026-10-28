import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Calls `onScreenshot` each time someone takes a phone screenshot while the
 * app is in front. Returns the unsubscribe, or null where we can't tell:
 * web, Android before 14 (it would have to read the photo library, which we
 * don't ask for; app.json blocks READ_MEDIA_IMAGES), and binaries built
 * before expo-screen-capture.
 *
 * OTA guard, as lib/shake.ts: expo-screen-capture calls requireNativeModule
 * when it loads, so older binaries would throw on a static import. ponytail:
 * import it normally once no supported binary predates it.
 */
export function listenForScreenshots(onScreenshot: () => void): (() => void) | null {
  if (Platform.OS === 'web' || (Platform.OS === 'android' && Number(Platform.Version) < 34)) return null;
  if (!requireOptionalNativeModule('ExpoScreenCapture')) return null;
  try {
    // A lazy require on purpose: a static import would load the native module on old binaries.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { addScreenshotListener } = require('expo-screen-capture') as typeof import('expo-screen-capture');
    const sub = addScreenshotListener(onScreenshot);
    return () => sub.remove();
  } catch {
    return null;
  }
}

/**
 * The app's screen as it is now, as a temporary JPEG, or null when it can't
 * be taken (a binary without react-native-view-shot throws here, not on import).
 */
export async function captureAppScreen(): Promise<string | null> {
  try {
    const { captureScreen } = await import('react-native-view-shot');
    return await captureScreen({ format: 'jpg', quality: 0.8, result: 'tmpfile' });
  } catch {
    return null;
  }
}
