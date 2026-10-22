import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { WhatNextScreen } from '@/components/screens/venueSetup/WhatNextScreen';

/** What next: your glasses and your menu, the steps from the end of venue setup. */
export default function WhatNextRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? <WhatNextScreen barId={id} /> : null}
    </VenueBrandProvider>
  );
}
