import type { ImageSourcePropType } from 'react-native';

/**
 * The native tab bars' icons: the app's own drawings (components/ui/glyphs.ts),
 * white on clear so the system tints them, off and on (the on one fills at 22%).
 * Drawn by scripts/nav-tab-icons.ts; run it after changing a tab's glyph.
 * Static requires: Metro bundles only what it can see.
 */

type TabImage = { default: ImageSourcePropType; selected: ImageSourcePropType };

export const TAB_IMAGES = {
  drinks: { default: require('@/assets/images/tabs/drinks.png'), selected: require('@/assets/images/tabs/drinks-on.png') },
  discover: { default: require('@/assets/images/tabs/discover.png'), selected: require('@/assets/images/tabs/discover-on.png') },
  you: { default: require('@/assets/images/tabs/you.png'), selected: require('@/assets/images/tabs/you-on.png') },
  search: { default: require('@/assets/images/tabs/search.png'), selected: require('@/assets/images/tabs/search-on.png') },
} satisfies Record<string, TabImage>;

/** Tonight's page for each day of the month, which turns over at 6am (hooks/useServiceDay.ts). */
const DAYS: TabImage[] = [
  { default: require('@/assets/images/tabs/tonight/1.png'), selected: require('@/assets/images/tabs/tonight/1-on.png') },
  { default: require('@/assets/images/tabs/tonight/2.png'), selected: require('@/assets/images/tabs/tonight/2-on.png') },
  { default: require('@/assets/images/tabs/tonight/3.png'), selected: require('@/assets/images/tabs/tonight/3-on.png') },
  { default: require('@/assets/images/tabs/tonight/4.png'), selected: require('@/assets/images/tabs/tonight/4-on.png') },
  { default: require('@/assets/images/tabs/tonight/5.png'), selected: require('@/assets/images/tabs/tonight/5-on.png') },
  { default: require('@/assets/images/tabs/tonight/6.png'), selected: require('@/assets/images/tabs/tonight/6-on.png') },
  { default: require('@/assets/images/tabs/tonight/7.png'), selected: require('@/assets/images/tabs/tonight/7-on.png') },
  { default: require('@/assets/images/tabs/tonight/8.png'), selected: require('@/assets/images/tabs/tonight/8-on.png') },
  { default: require('@/assets/images/tabs/tonight/9.png'), selected: require('@/assets/images/tabs/tonight/9-on.png') },
  { default: require('@/assets/images/tabs/tonight/10.png'), selected: require('@/assets/images/tabs/tonight/10-on.png') },
  { default: require('@/assets/images/tabs/tonight/11.png'), selected: require('@/assets/images/tabs/tonight/11-on.png') },
  { default: require('@/assets/images/tabs/tonight/12.png'), selected: require('@/assets/images/tabs/tonight/12-on.png') },
  { default: require('@/assets/images/tabs/tonight/13.png'), selected: require('@/assets/images/tabs/tonight/13-on.png') },
  { default: require('@/assets/images/tabs/tonight/14.png'), selected: require('@/assets/images/tabs/tonight/14-on.png') },
  { default: require('@/assets/images/tabs/tonight/15.png'), selected: require('@/assets/images/tabs/tonight/15-on.png') },
  { default: require('@/assets/images/tabs/tonight/16.png'), selected: require('@/assets/images/tabs/tonight/16-on.png') },
  { default: require('@/assets/images/tabs/tonight/17.png'), selected: require('@/assets/images/tabs/tonight/17-on.png') },
  { default: require('@/assets/images/tabs/tonight/18.png'), selected: require('@/assets/images/tabs/tonight/18-on.png') },
  { default: require('@/assets/images/tabs/tonight/19.png'), selected: require('@/assets/images/tabs/tonight/19-on.png') },
  { default: require('@/assets/images/tabs/tonight/20.png'), selected: require('@/assets/images/tabs/tonight/20-on.png') },
  { default: require('@/assets/images/tabs/tonight/21.png'), selected: require('@/assets/images/tabs/tonight/21-on.png') },
  { default: require('@/assets/images/tabs/tonight/22.png'), selected: require('@/assets/images/tabs/tonight/22-on.png') },
  { default: require('@/assets/images/tabs/tonight/23.png'), selected: require('@/assets/images/tabs/tonight/23-on.png') },
  { default: require('@/assets/images/tabs/tonight/24.png'), selected: require('@/assets/images/tabs/tonight/24-on.png') },
  { default: require('@/assets/images/tabs/tonight/25.png'), selected: require('@/assets/images/tabs/tonight/25-on.png') },
  { default: require('@/assets/images/tabs/tonight/26.png'), selected: require('@/assets/images/tabs/tonight/26-on.png') },
  { default: require('@/assets/images/tabs/tonight/27.png'), selected: require('@/assets/images/tabs/tonight/27-on.png') },
  { default: require('@/assets/images/tabs/tonight/28.png'), selected: require('@/assets/images/tabs/tonight/28-on.png') },
  { default: require('@/assets/images/tabs/tonight/29.png'), selected: require('@/assets/images/tabs/tonight/29-on.png') },
  { default: require('@/assets/images/tabs/tonight/30.png'), selected: require('@/assets/images/tabs/tonight/30-on.png') },
  { default: require('@/assets/images/tabs/tonight/31.png'), selected: require('@/assets/images/tabs/tonight/31-on.png') },
];

/** Tonight's tab for a day of the month (1 to 31). */
export const tonightImage = (day: number): TabImage => DAYS[day - 1];
