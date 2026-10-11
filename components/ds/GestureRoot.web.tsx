import { View, type ViewProps } from 'react-native';

/**
 * The web needs no Gesture Handler root (its checks skip the web), and
 * importing Gesture Handler loads Reanimated with it: a plain view keeps both
 * off every page. Screens with gestures load them with their own code.
 */
export function GestureRoot(props: ViewProps) {
  return <View {...props} />;
}
