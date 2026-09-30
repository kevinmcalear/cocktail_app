import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { MenuEditorScreen } from '@/components/screens/menus/MenuEditorScreen';
import { WebHead } from '@/components/WebHead';

/** Editing a menu. */
export default function MenuEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Edit menu', gestureEnabled: false }} />
      <WebHead>
        <title>Edit menu</title>
      </WebHead>
      <MenuEditorScreen menuId={id} />
    </VenueBrandProvider>
  );
}
