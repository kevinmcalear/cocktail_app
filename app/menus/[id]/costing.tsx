import { Stack, useLocalSearchParams } from 'expo-router';

import { MenuCostingScreen } from '@/components/screens/menus/MenuCostingScreen';

/** Every drink on a menu with its cost, price and GP, for the costs capability. */
export default function MenuCostingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MenuCostingScreen menuId={id} />
    </>
  );
}
