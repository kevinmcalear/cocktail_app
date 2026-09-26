import { Platform, useWindowDimensions } from 'react-native';

import { useIsHydrated } from '@/hooks/useIsHydrated';

/** Web at least this wide gets the desktop sidebar; narrower web uses the phone tab bar. */
export const WIDE_WEB_MIN_WIDTH = 768;

export function useIsWideWeb(): boolean {
  const { width } = useWindowDimensions();
  // The static export renders with a zero-width window (the phone layout), so
  // hydrate that layout and switch to the sidebar right after.
  const isHydrated = useIsHydrated();
  return Platform.OS === 'web' && isHydrated && width >= WIDE_WEB_MIN_WIDTH;
}
