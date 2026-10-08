import { Stack } from 'expo-router';

import { FlavorMapScreen } from '@/components/screens/flavorMap/FlavorMapScreen';

/** What pairs with what. Opened from an ingredient's page, the add-drink wizard and search (?with=id,id). */
export default function FlavorMapRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Flavor map' }} />
      <FlavorMapScreen />
    </>
  );
}
