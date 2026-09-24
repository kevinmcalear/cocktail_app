import { Platform, useWindowDimensions } from 'react-native';

/** Web at least this wide gets the desktop sidebar; narrower web uses the phone tab bar. */
export const WIDE_WEB_MIN_WIDTH = 768;

export function useIsWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_WEB_MIN_WIDTH;
}
