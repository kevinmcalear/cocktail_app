import { useLocalSearchParams } from 'expo-router';

import { InMenu } from '@/components/screens/menus/pager/InMenu';
import { PublishedDrinkScreen } from '@/components/screens/published/PublishedDrinkScreen';
import { DrinkingAgeGate } from '@/components/screens/safety/DrinkingAgeGate';

/**
 * A published drink's public page: /d/<id> or /d/<slug> (/d/penicillin), from
 * a release with ?release=<id>.
 * Opens signed out, behind the drinking-age question on web.
 */
export default function PublishedDrinkRoute() {
  const { id, release } = useLocalSearchParams<{ id: string; release?: string }>();
  return (
    <DrinkingAgeGate>
      {/* Opened from a bar's menu (?menu=&bar=), the menu's pager (Menu-pager). */}
      <InMenu itemId={id}>
        <PublishedDrinkScreen id={id} releaseId={release ?? null} />
      </InMenu>
    </DrinkingAgeGate>
  );
}
