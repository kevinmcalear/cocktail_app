import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { DilutionScreen } from '@/components/screens/venue/DilutionScreen';

/** A venue's house dilution by method. */
export default function DilutionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      <DilutionScreen barId={id} />
    </VenueBrandProvider>
  );
}
