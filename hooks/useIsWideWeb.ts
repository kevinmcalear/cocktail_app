import { Platform, useWindowDimensions } from 'react-native';

import { layout } from '@/constants/tokens';
import { webNavFor, type WebNav } from '@/lib/shellNav';

export type { WebNav };

/** Web at least this wide gets the side nav (the rail, then the sidebar); narrower web uses the phone tab bar. */
export const WIDE_WEB_MIN_WIDTH = layout.breakpoints.tablet;

/** How wide the side nav is: the full sidebar on a desktop window, the icon rail on a tablet-sized one. */
export const WEB_SIDEBAR_WIDTH = 240;
export const WEB_RAIL_WIDTH = 80;

export function useWebNav(): WebNav {
  // The static export renders with a zero-width window (the phone layout), and
  // hydration repeats that before the real width arrives (see
  // patches/react-native-web+*.patch), so the side nav appears right after.
  return webNavFor(Platform.OS, useWindowDimensions().width);
}

/** True when the web has a side nav (rail or sidebar) instead of the phone tab bar. */
export function useIsWideWeb(): boolean {
  return useWebNav() !== 'tabs';
}

/** The width the side nav takes from the window: 0 on phones and native. */
export function useWebNavWidth(): number {
  const nav = useWebNav();
  return nav === 'sidebar' ? WEB_SIDEBAR_WIDTH : nav === 'rail' ? WEB_RAIL_WIDTH : 0;
}
