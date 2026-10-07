import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { MenuFromPhotoScreen } from '@/components/screens/menus/MenuFromPhotoScreen';
import { WebHead } from '@/components/WebHead';

/** Reviewing what a photo of a printed menu read, before it becomes a menu. */
export default function MenuFromPhotoRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Menu from a photo' }} />
      <WebHead>
        <title>Menu from a photo</title>
      </WebHead>
      <MenuFromPhotoScreen />
    </VenueBrandProvider>
  );
}
