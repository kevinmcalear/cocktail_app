import type { StyleProp, ViewStyle } from 'react-native';

export type FabIcon = 'plus' | 'checkmark' | 'rank' | 'printer';

export interface ExtendedFabProps {
  label: string;
  icon: FabIcon;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Off: the round FAB, the label gone (it shrinks as the page scrolls). */
  open?: boolean;
  /** Its fill and ink. Left out: the venue's accent. */
  colors?: { fill: string; text: string };
  /** Where it sits over the page. */
  style?: StyleProp<ViewStyle>;
}

/** Android only: ExtendedFab.android.tsx. iOS and the web keep the action inline. */
export function ExtendedFab(_: ExtendedFabProps) {
  return null;
}
