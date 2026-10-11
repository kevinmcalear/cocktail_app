import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { NO_SHAKE, readShake, type ShakeState } from './eightBall';

type AccelerometerModule = typeof import('expo-sensors').Accelerometer;

let accelerometer: AccelerometerModule | null | undefined;

/**
 * The accelerometer, or null where there isn't one we can use: web (wide web
 * has ⇧⌘8 instead), and native binaries built before expo-sensors was added.
 *
 * OTA guard: the 1.3.0 store binaries don't contain the ExponentAccelerometer
 * native module, but they get JS updates from main. Importing expo-sensors
 * there throws at load (its modules call requireNativeModule), so this asks
 * whether the module exists first and only then requires the package. Keep
 * expo-sensors out of every static import. ponytail: remove the guard (and
 * import it normally) once no supported binary predates it.
 */
function loadAccelerometer(): AccelerometerModule | null {
  if (accelerometer !== undefined) return accelerometer;
  accelerometer = null;
  if (Platform.OS === 'web' || !requireOptionalNativeModule('ExponentAccelerometer')) return null;
  try {
    // A lazy require on purpose: a static import would load the native module on old binaries.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    accelerometer = (require('expo-sensors') as typeof import('expo-sensors')).Accelerometer;
  } catch {
    accelerometer = null;
  }
  return accelerometer;
}

/**
 * Calls `onShake` once per shake (see readShake for what counts). Returns
 * the unsubscribe, or null when shakes aren't available here.
 */
export function listenForShakes(onShake: () => void): (() => void) | null {
  const sensor = loadAccelerometer();
  if (!sensor) return null;
  let state: ShakeState = NO_SHAKE;
  // 20 readings a second: enough to catch a shake, cheap on the battery.
  sensor.setUpdateInterval(50);
  const sub = sensor.addListener(({ x, y, z }) => {
    const next = readShake(state, { x, y, z, at: Date.now() });
    state = next.state;
    if (next.shook) onShake();
  });
  return () => sub.remove();
}
