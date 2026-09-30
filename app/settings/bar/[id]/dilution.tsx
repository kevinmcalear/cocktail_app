import { Stack, useLocalSearchParams } from 'expo-router';

import { DilutionScreen } from '@/components/screens/venue/DilutionScreen';

/** A venue's house dilution by method. */
export default function DilutionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DilutionScreen barId={id} />
    </>
  );
}
