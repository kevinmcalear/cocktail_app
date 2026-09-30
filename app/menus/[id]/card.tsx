import { Stack, useLocalSearchParams } from 'expo-router';

import { MenuCardScreen } from '@/components/screens/menus/MenuCardScreen';
import { WebHead } from '@/components/WebHead';

/** The guest menu, to print or share. */
export default function MenuCardRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
