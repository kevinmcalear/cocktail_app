import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { SuppliersScreen } from '@/components/screens/venue/SuppliersScreen';

/** Who a venue orders from, under Buying in its settings. */
export default function SuppliersRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? <SuppliersScreen barId={id} /> : null}
    </VenueBrandProvider>
  );
}
