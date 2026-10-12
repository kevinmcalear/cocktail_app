import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { BringInFlow } from '@/components/screens/bringin/BringInFlow';
import { WebHead } from '@/components/WebHead';

/** Bring in: what you gave it, read and checked before anything saves. */
export default function BringInRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Bring in' }} />
      <WebHead>
        <title>Bring in</title>
      </WebHead>
      <BringInFlow />
    </VenueBrandProvider>
  );
}
