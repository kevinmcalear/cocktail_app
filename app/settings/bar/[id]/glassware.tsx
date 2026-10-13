import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { GlasswareScreen } from '@/components/screens/venue/GlasswareScreen';

/** The glasses a venue pours into. */
export default function GlasswareRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? <GlasswareScreen barId={id} /> : null}
    </VenueBrandProvider>
  );
}
