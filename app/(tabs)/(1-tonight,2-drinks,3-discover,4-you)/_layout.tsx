import { Stack, useSegments } from 'expo-router';
import { Platform } from 'react-native';

import { AddFab } from '@/components/nav/AddButton';

/**
 * Each tab's own stack. This folder is shared by the four tab groups, so a
 * page here (a drink, Prep, Study) opens on the stack of the tab it was
 * opened from, and Back returns to that tab. Each tab's first page lives in
 * its own folder ((1-tonight)/index, (2-drinks)/drinks, (3-discover)/discover,
 * (4-you)/you), so /drinks always switches to the Drinks tab rather than
 * pushing it on the tab you're in.
 *
 * Today's pages draw their own headers (components/nav/ScreenHeader.tsx), so
 * the stack's header stays hidden; a pushed page goes back with the system's
 * swipe or back button, and with its own back on the web.
 */
export const unstable_settings = {
  '1-tonight': { anchor: 'index' },
  '2-drinks': { anchor: 'drinks' },
  '3-discover': { anchor: 'discover' },
  '4-you': { anchor: 'you' },
};

const ROOTS = [undefined, 'drinks', 'discover', 'you'];

export default function TabStack() {
  // ['(tabs)', '(2-drinks)', 'drinks'] is a first page; ['(tabs)', '(1-tonight)'] is Tonight's.
  const page = (useSegments() as string[])[2];
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {/* Android's Add floats on each tab's first page (AddButton.tsx); iOS and the web have the + in the header. */}
      {Platform.OS === 'android' && ROOTS.includes(page) ? <AddFab /> : null}
    </>
  );
}
