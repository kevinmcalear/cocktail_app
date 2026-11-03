import { Stack, useLocalSearchParams } from 'expo-router';

import { BarFeatureGate } from '@/components/bar/BarFeatureGate';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { KitIceScreen } from '@/components/screens/venue/KitIceScreen';

/** A venue's ice, under Kit in its settings. */
export default function IceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? (
        <BarFeatureGate barId={id} feature="advanced">
          <KitIceScreen barId={id} />
        </BarFeatureGate>
      ) : null}
    </VenueBrandProvider>
  );
}
