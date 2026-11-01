import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { MenusScreen } from '@/components/screens/menus/MenusScreen';
import { WebHead } from '@/components/WebHead';
import { useRoundVisit } from '@/hooks/useFirstRound';

/** Every menu at the venue. */
export default function AllMenusRoute() {
  useRoundVisit('menus');
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
