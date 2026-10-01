import { Stack } from 'expo-router';

import { BringInScreen } from '@/components/screens/library/BringInScreen';
import { WebHead } from '@/components/WebHead';

/** Paste drinks or bottles into the venue’s library. */
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
