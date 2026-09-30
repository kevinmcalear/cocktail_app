import { Stack, useLocalSearchParams } from 'expo-router';

import { PricingScreen } from '@/components/screens/venue/PricingScreen';

/** A venue's currency, tax and target GP. */
export default function PricingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PricingScreen barId={id} />
    </>
  );
}
