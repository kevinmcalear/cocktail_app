import { Stack } from 'expo-router';

import { VenueSetupScreen } from '@/components/screens/venueSetup/VenueSetupScreen';

/** Setting up a venue: find the bar, claim it, and set it up while the claim is checked. */
export default function VenueSetupRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Venue setup' }} />
      <VenueSetupScreen />
    </>
  );
}
