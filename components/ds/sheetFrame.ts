import { Platform, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/tokens';

/**
 * Where a sheet sits. Phones: up from the bottom. The web, at any width: a
 * dialog in the middle of the window, because a panel docked to the bottom of
 * a browser reads as a phone screen. The app's Sheet (./Sheet.tsx) takes its
 * placement from here; build sheets on Sheet rather than on these styles.
 */
export const sheetIsDialog = Platform.OS === 'web';

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
