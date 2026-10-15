import { Stack } from 'expo-router';

import { HiddenBarsScreen } from '@/components/screens/safety/HiddenBarsScreen';

/** Settings › Hidden bars. */
export default function HiddenBarsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Hidden bars' }} />
      <HiddenBarsScreen />
    </>
  );
}
