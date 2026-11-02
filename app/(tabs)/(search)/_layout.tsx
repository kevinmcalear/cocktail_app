import { Stack } from 'expo-router';

/**
 * iPhone's search tab is a stack of one screen so that iOS 26 can turn the tab
 * bar into the screen's native search field (it only does that for a
 * navigation stack; hooks/useBottomBar.ts SYSTEM_BOTTOM_SEARCH). Before iOS 26
 * the header stays hidden and the screen draws its own bottom field.
 */
export default function SearchLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
