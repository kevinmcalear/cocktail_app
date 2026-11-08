import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { BarFeatureGate } from '@/components/bar/BarFeatureGate';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { SuppliersScreen } from '@/components/screens/venue/SuppliersScreen';
import { useBackBarShown } from '@/hooks/useBackBarShown';

/** Who a venue orders from, under Buying in its settings. Parked with the back bar (lib/backBar.ts), and goes with its switch. */
export default function SuppliersRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shown = useBackBarShown();
  if (id && !shown) return <Redirect href={`/settings/bar/${id}`} />;
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? (
        <BarFeatureGate barId={id} feature="backBar">
          <SuppliersScreen barId={id} />
        </BarFeatureGate>
      ) : null}
    </VenueBrandProvider>
  );
}
