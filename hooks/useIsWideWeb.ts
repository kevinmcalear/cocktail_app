import { Platform, useWindowDimensions } from 'react-native';

import { layout } from '@/constants/tokens';
import { webNavFor, type WebNav } from '@/lib/shellNav';

export type { WebNav };

/**
 * Web (and a native iPad) at least this wide gets the side nav (the rail,
 * then the sidebar); narrower uses the phone tab bar.
 * ponytail: "WideWeb" names predate iPad joining; renaming every caller is its own change.
 */
export const WIDE_WEB_MIN_WIDTH = layout.breakpoints.tablet;

/** How wide the side nav is: the full sidebar on a desktop window, the icon rail on a tablet-sized one. */
export const WEB_SIDEBAR_WIDTH = 240;
export const WEB_RAIL_WIDTH = 80;

const IS_PAD = Platform.OS === 'ios' && Platform.isPad;

export function useWebNav(): WebNav {
  // The static export renders with a zero-width window (the phone layout), and
  // hydration repeats that before the real width arrives (see
  // patches/react-native-web+*.patch), so the side nav appears right after.
  return webNavFor(Platform.OS, useWindowDimensions().width, IS_PAD);
}

/** True when there's a side nav (rail or sidebar) instead of the phone tab bar: wide web, or a native iPad. */
export function useIsWideWeb(): boolean {
  return useWebNav() !== 'tabs';
}

/** The width the side nav takes from the window: 0 with the phone tab bar. */
export function useWebNavWidth(): number {
  const nav = useWebNav();
  return nav === 'sidebar' ? WEB_SIDEBAR_WIDTH : nav === 'rail' ? WEB_RAIL_WIDTH : 0;
}
