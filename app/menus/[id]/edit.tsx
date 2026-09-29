import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { MenuEditorScreen } from '@/components/screens/menus/MenuEditorScreen';
import { WebHead } from '@/components/WebHead';
import { useRedesign } from '@/lib/flags';

/** Editing a menu. Redesign only; the current app edits in the Menus tab. */
export default function MenuEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const redesign = useRedesign();
  if (!redesign) return <Redirect href="/menus" />;
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
