import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { MenuScreen } from '@/components/screens/menus/MenuScreen';
import { WebHead } from '@/components/WebHead';

/** One menu. */
export default function MenuRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Menu' }} />
      <WebHead>
        <title>Menu</title>
      </WebHead>
      <MenuScreen menuId={id} />
    </VenueBrandProvider>
  );
}
