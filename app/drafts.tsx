import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { DraftsScreen } from '@/components/screens/drafts/DraftsScreen';
import { WebHead } from '@/components/WebHead';

/** New > Drafts. */
export default function DraftsRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Drafts' }} />
      <WebHead>
        <title>Drafts</title>
      </WebHead>
      <DraftsScreen />
    </VenueBrandProvider>
  );
}
