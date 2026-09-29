import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { MenuCardScreen } from '@/components/screens/menus/MenuCardScreen';
import { WebHead } from '@/components/WebHead';
import { useRedesign } from '@/lib/flags';

/** The guest menu, to print or share. Redesign only. */
export default function MenuCardRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const redesign = useRedesign();
  if (!redesign) return <Redirect href="/menus" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Guest menu' }} />
      <WebHead>
        <title>Guest menu</title>
      </WebHead>
      <MenuCardScreen menuId={id} />
    </>
  );
}
