import { Stack, useLocalSearchParams } from 'expo-router';

import { RoleLensScreen } from '@/components/screens/drink/RoleLensScreen';
import { useCocktail } from '@/hooks/useCocktails';

/** Who sees what on a venue drink (from the drink page's More menu). */
export default function RolesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useCocktail(id);
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Who sees what' }} />
      <RoleLensScreen itemId={id} barId={data?.bar_id ?? null} name={data?.name ?? null} />
    </>
  );
}
