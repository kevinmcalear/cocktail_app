import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { PageVisibilityScreen } from '@/components/screens/publishing/PageVisibilityScreen';

/** Venue settings › Publishing › Who sees your page. */
export default function PageVisibilityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageVisibilityScreen barId={id} />
    </VenueBrandProvider>
  );
}
