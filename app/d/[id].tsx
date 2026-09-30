import { useLocalSearchParams } from 'expo-router';

import { PublishedDrinkScreen } from '@/components/screens/published/PublishedDrinkScreen';
import { DrinkingAgeGate } from '@/components/screens/safety/DrinkingAgeGate';

/**
 * A published drink's public page: /d/<id>, from a release with ?release=<id>.
 * Opens signed out, behind the drinking-age question on web.
 */
export default function PublishedDrinkRoute() {
  const { id, release } = useLocalSearchParams<{ id: string; release?: string }>();
  return (
    <DrinkingAgeGate>
      <PublishedDrinkScreen id={id} releaseId={release ?? null} />
    </DrinkingAgeGate>
  );
}
