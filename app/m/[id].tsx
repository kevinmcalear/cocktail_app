import { useLocalSearchParams } from 'expo-router';

import { SharedMenuScreen } from '@/components/screens/published/SharedMenuScreen';
import { DrinkingAgeGate } from '@/components/screens/safety/DrinkingAgeGate';

/** A home menu someone shared: /m/<id>. Opens signed out, behind the drinking-age question on web. */
export default function SharedMenuRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <DrinkingAgeGate>
      <SharedMenuScreen id={id} />
    </DrinkingAgeGate>
  );
}
