import { Stack, useLocalSearchParams } from 'expo-router';

import { EventScreen } from '@/components/screens/week/EventScreen';
import { DrinkingAgeGate } from '@/components/screens/safety/DrinkingAgeGate';
import { WebHead } from '@/components/WebHead';

/** An event: /e/<id>. Public events open signed out, behind the drinking-age question on web; team-only ones for the team. */
export default function EventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <DrinkingAgeGate>
      <Stack.Screen options={{ headerShown: false, title: 'Event' }} />
      <WebHead>
        <title>Event</title>
      </WebHead>
      <EventScreen id={id} />
    </DrinkingAgeGate>
  );
}
