import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { MenusScreen } from '@/components/screens/menus/MenusScreen';
import { WebHead } from '@/components/WebHead';

/** Every menu at the venue. */
export default function AllMenusRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Menus' }} />
      <WebHead>
        <title>Menus</title>
      </WebHead>
      <MenusScreen />
    </VenueBrandProvider>
  );
}
