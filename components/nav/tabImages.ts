import { Platform, type ImageSourcePropType } from 'react-native';

/**
 * The native tab bars' icons: the app's own drawings (components/ui/glyphs.ts),
 * white on clear so the system tints them. Selected tabs are the same outline,
 * in the selected colour (Prod-phone); Android's selected Drinks fills its
 * bowl (Kept-glyph). Drawn by scripts/nav-tab-icons.ts; run it after changing
 * a tab's glyph. Static requires: Metro bundles only what it can see.
 */

const DRINKS: ImageSourcePropType = require('@/assets/images/tabs/drinks.png');

export const TAB_IMAGES = {
  drinks: Platform.OS === 'android' ? { default: DRINKS, selected: require('@/assets/images/tabs/drinks-on.png') as ImageSourcePropType } : DRINKS,
  discover: require('@/assets/images/tabs/discover.png') as ImageSourcePropType,
  you: require('@/assets/images/tabs/you.png') as ImageSourcePropType,
};

/** Tonight's page for each day of the month, which turns over at 6am (hooks/useServiceDay.ts). */
const DAYS: ImageSourcePropType[] = [
  require('@/assets/images/tabs/tonight/1.png'),
  require('@/assets/images/tabs/tonight/2.png'),
  require('@/assets/images/tabs/tonight/3.png'),
  require('@/assets/images/tabs/tonight/4.png'),
  require('@/assets/images/tabs/tonight/5.png'),
  require('@/assets/images/tabs/tonight/6.png'),
  require('@/assets/images/tabs/tonight/7.png'),
  require('@/assets/images/tabs/tonight/8.png'),
  require('@/assets/images/tabs/tonight/9.png'),
  require('@/assets/images/tabs/tonight/10.png'),
  require('@/assets/images/tabs/tonight/11.png'),
  require('@/assets/images/tabs/tonight/12.png'),
  require('@/assets/images/tabs/tonight/13.png'),
  require('@/assets/images/tabs/tonight/14.png'),
  require('@/assets/images/tabs/tonight/15.png'),
  require('@/assets/images/tabs/tonight/16.png'),
  require('@/assets/images/tabs/tonight/17.png'),
  require('@/assets/images/tabs/tonight/18.png'),
  require('@/assets/images/tabs/tonight/19.png'),
  require('@/assets/images/tabs/tonight/20.png'),
  require('@/assets/images/tabs/tonight/21.png'),
  require('@/assets/images/tabs/tonight/22.png'),
  require('@/assets/images/tabs/tonight/23.png'),
  require('@/assets/images/tabs/tonight/24.png'),
  require('@/assets/images/tabs/tonight/25.png'),
  require('@/assets/images/tabs/tonight/26.png'),
  require('@/assets/images/tabs/tonight/27.png'),
  require('@/assets/images/tabs/tonight/28.png'),
  require('@/assets/images/tabs/tonight/29.png'),
  require('@/assets/images/tabs/tonight/30.png'),
  require('@/assets/images/tabs/tonight/31.png'),
];

export const tonightImage = (day: number): ImageSourcePropType => DAYS[day - 1];
