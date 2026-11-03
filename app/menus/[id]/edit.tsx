import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { MenuEditScreen } from '@/components/screens/menus/edit/MenuEditScreen';
import { WebHead } from '@/components/WebHead';

/** Editing a menu in place. */
export default function MenuEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Edit menu', gestureEnabled: false }} />
      <WebHead>
        <title>Edit menu</title>
      </WebHead>
      <MenuEditScreen menuId={id} />
    </VenueBrandProvider>
  );
}
