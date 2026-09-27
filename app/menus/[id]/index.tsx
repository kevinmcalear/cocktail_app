import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { MenuScreen } from '@/components/screens/menus/MenuScreen';
import { WebHead } from '@/components/WebHead';
import { useRedesign } from '@/lib/flags';

/** One menu. Redesign only; the current app shows menus in the Menus tab. */
export default function MenuRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const redesign = useRedesign();
  if (!redesign) return <Redirect href="/menus" />;
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
