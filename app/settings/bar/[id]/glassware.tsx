import { Stack, useLocalSearchParams } from 'expo-router';

import { GlasswareScreen } from '@/components/screens/venue/GlasswareScreen';

/** The glasses a venue pours into. */
export default function GlasswareRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? <GlasswareScreen barId={id} /> : null}
    </>
  );
}
