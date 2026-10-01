import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { OffMenuScreen } from '@/components/screens/off-menu/OffMenuScreen';
import { WebHead } from '@/components/WebHead';

/** Classics the venue can make that aren't on the menu. From the sidebar, and from Menus on a phone. */
export default function OffMenuRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Off menu' }} />
      <WebHead>
        <title>Off menu</title>
      </WebHead>
      <OffMenuScreen />
    </VenueBrandProvider>
  );
}
