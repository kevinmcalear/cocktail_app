import { Stack } from 'expo-router';

/**
 * The search tab is a stack of one screen so that, with Settings › Try it on,
 * iOS 26 can turn the tab bar into the screen's native search field (it only
 * does that for a navigation stack). With it off the header stays hidden and
 * the screen is the same as ever.
 */
export default function SearchLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
