import { useLocalSearchParams } from 'expo-router';

import { ReleaseScreen } from '@/components/screens/published/ReleaseScreen';
import { DrinkingAgeGate } from '@/components/screens/safety/DrinkingAgeGate';

/** A bar's live release: /r/<id>. Opens signed out, behind the drinking-age question on web. */
export default function ReleaseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <DrinkingAgeGate>
      <ReleaseScreen id={id} />
    </DrinkingAgeGate>
  );
}
