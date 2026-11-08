import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { BarFeatureGate } from '@/components/bar/BarFeatureGate';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { SuppliersScreen } from '@/components/screens/venue/SuppliersScreen';
import { BACK_BAR_SHOWN } from '@/lib/backBar';

/**
 * Who a venue orders from, under Buying in its settings. Parked with the back bar (lib/backBar.ts), and goes with
 * this bar's own switch, as its Buying row does (VenueSettingsLinks): BarFeatureGate waits for the switch, so a cold link doesn't bounce.
 */
export default function SuppliersRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id && !BACK_BAR_SHOWN) return <Redirect href={`/settings/bar/${id}`} />;
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
