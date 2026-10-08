import { Stack } from 'expo-router';

import { BringInScreen } from '@/components/screens/library/BringInScreen';
import { WebHead } from '@/components/WebHead';

/** Bring in: paste, snap or drop drinks, a menu or bottles into the library. */
export default function BringInRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Bring in' }} />
      <WebHead>
        <title>Bring in</title>
      </WebHead>
      <BringInScreen />
    </>
  );
}
