import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { IceRecipeScreen } from '@/components/screens/ice/IceRecipeScreen';

/** How a venue's ice is made, under Kit › Ice in its settings. */
export default function IceRecipeRoute() {
  const { id, iceId } = useLocalSearchParams<{ id: string; iceId: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id && iceId ? <IceRecipeScreen barId={id} iceId={iceId} /> : null}
    </VenueBrandProvider>
  );
}
