import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { PastMenusScreen } from '@/components/screens/menus/PastMenusScreen';
import { WebHead } from '@/components/WebHead';

/** A bar's past menus as a timeline. */
export default function PastMenusRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Past menus' }} />
      <WebHead>
        <title>Past menus</title>
      </WebHead>
      <PastMenusScreen />
    </VenueBrandProvider>
  );
}
