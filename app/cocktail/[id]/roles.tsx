import { Stack, useLocalSearchParams } from 'expo-router';

import { RoleLensScreen } from '@/components/screens/drink/RoleLensScreen';
import { useCocktail } from '@/hooks/useCocktails';

/** What each role opens on a venue drink (from View as, on the drink page). */
export default function RolesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useCocktail(id);
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'What each role opens' }} />
      <RoleLensScreen itemId={id} barId={data?.bar_id ?? null} />
    </>
  );
}
