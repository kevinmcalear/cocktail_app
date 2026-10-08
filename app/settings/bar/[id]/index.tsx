import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueSettingsScreen } from '@/components/screens/venue/VenueSettingsScreen';

/** One venue's settings, opened from Venues in Settings. */
export default function VenueSettingsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? <VenueSettingsScreen barId={id} /> : null}
    </>
  );
}
