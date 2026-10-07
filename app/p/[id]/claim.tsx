import { Stack, useLocalSearchParams } from 'expo-router';

import { BarClaimScreen } from '@/components/screens/claim/BarClaimScreen';

/** Claiming a bar's page: /p/<uuid>/claim or /p/pale.moth/claim. */
export default function ClaimRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BarClaimScreen profileRef={id} />
    </>
  );
}
