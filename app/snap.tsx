import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { SnapScreen } from '@/components/screens/snap/SnapScreen';
import { WebHead } from '@/components/WebHead';

/** Add's Snap: the live viewfinder (Prod-add-flow, step 1). */
export default function SnapRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Snap' }} />
      <WebHead>
        <title>Snap</title>
      </WebHead>
      <SnapScreen />
    </VenueBrandProvider>
  );
}
