import { Redirect, Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { MenusScreen } from '@/components/screens/menus/MenusScreen';
import { WebHead } from '@/components/WebHead';
import { useRedesign } from '@/lib/flags';

/** Every menu at the venue. Redesign only; the current app has the Menus tab. */
export default function AllMenusRoute() {
  const redesign = useRedesign();
  if (!redesign) return <Redirect href="/menus" />;
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
