import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { IceRecipeScreen } from '@/components/screens/ice/IceRecipeScreen';

/** How a venue's ice is made: under its page in Kit › Ice, so Back returns there. */
export default function IceRecipeRoute() {
  const { id, item } = useLocalSearchParams<{ id: string; item: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id && item ? <IceRecipeScreen barId={id} iceId={item} /> : null}
    </VenueBrandProvider>
  );
}
