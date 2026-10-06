import { useLocalSearchParams } from 'expo-router';

import { MenuEditionScreen } from '@/components/screens/profile/MenuEditionScreen';
import { DrinkingAgeGate } from '@/components/screens/safety/DrinkingAgeGate';

/** One menu a bar put out: /p/<bar>/menus/<edition>. Opens signed out, behind the drinking-age question on web. */
export default function MenuEditionRoute() {
  const { id, edition } = useLocalSearchParams<{ id: string; edition: string }>();
  return (
    <DrinkingAgeGate>
      <MenuEditionScreen profileRef={id} editionId={edition} />
    </DrinkingAgeGate>
  );
}
