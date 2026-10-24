import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { FeaturesScreen } from '@/components/screens/venue/FeaturesScreen';

/** A venue's Features, opened from the venue menu and the sidebar. */
export default function FeaturesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? <FeaturesScreen barId={id} /> : null}
    </VenueBrandProvider>
  );
}
