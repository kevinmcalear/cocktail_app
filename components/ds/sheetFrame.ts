import { Platform, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/tokens';

/**
 * Where a sheet sits. Phones: up from the bottom. The web, at any width: a
 * dialog in the middle of the window, because a panel docked to the bottom of
 * a browser reads as a phone screen. Every sheet takes its placement from
 * here: merge `sheetFrame.scrim` onto the full-screen layer that places the
 * sheet and `sheetFrame.panel` onto the sheet (with a `borderColor`), and drop
 * the grabber and the slide when `sheetIsDialog`.
 */
export const sheetIsDialog = Platform.OS === 'web';
export const sheetAnimation = sheetIsDialog ? 'fade' : 'slide';

const corner = radius.card;

export const sheetFrame = StyleSheet.create({
  scrim: sheetIsDialog ? { justifyContent: 'center', alignItems: 'center', padding: space.xl } : {},
  // The sheet keeps its own maxWidth. Every corner, not borderRadius: a sheet's
  // own top-corner radii would win over it.
  panel: sheetIsDialog
    ? {
        width: '100%',
        borderTopLeftRadius: corner,
        borderTopRightRadius: corner,
        borderBottomLeftRadius: corner,
        borderBottomRightRadius: corner,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
      }
    : {},
});
