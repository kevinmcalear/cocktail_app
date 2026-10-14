import type { SharedValue, Value3D } from 'react-native-reanimated';

/**
 * No tilt on the web: browsers ask permission for motion (or only allow it
 * over https), and Reanimated warns when there's no sensor. The ball is
 * dragged and flung instead. See useTilt.ts.
 */
export function useTilt(): SharedValue<Value3D> | null {
  return null;
}
