import { Stack, useLocalSearchParams } from 'expo-router';

import { BarFeatureGate } from '@/components/bar/BarFeatureGate';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { CalendarsScreen } from '@/components/screens/calendars/CalendarsScreen';

/** A venue's calendars: what brings events in, its public feed, and its team-only words. */
export default function CalendarsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? (
        <BarFeatureGate barId={id} feature="tonight">
          <CalendarsScreen barId={id} />
        </BarFeatureGate>
      ) : null}
    </VenueBrandProvider>
  );
}
