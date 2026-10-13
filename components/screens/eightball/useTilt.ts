import { SensorType, useAnimatedSensor, type SharedValue, type Value3D } from 'react-native-reanimated';

/**
 * The phone's gravity on the UI thread, for rolling the ball. Reanimated's
 * own sensor, so no extra native module (expo-sensors stays guarded in
 * lib/shake.ts). Reads zeros where there's no sensor, as on the simulator.
 * Listens only while the ball is open. The web has none (useTilt.web.ts):
 * the ball is dragged and flung there.
 */
export function useTilt(): SharedValue<Value3D> | null {
  return useAnimatedSensor(SensorType.GRAVITY).sensor;
}
