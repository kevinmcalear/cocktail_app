import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { KitIceScreen } from '@/components/screens/venue/KitIceScreen';

/** A venue's ice, under Kit in its settings. */
export default function IceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? <KitIceScreen barId={id} /> : null}
    </VenueBrandProvider>
  );
}
