import { Stack } from 'expo-router';

import { FlavorMapScreen } from '@/components/screens/flavorMap/FlavorMapScreen';
import { FeatureGate } from '@/components/nav/FeatureGate';

/** What pairs with what. Opened from an ingredient's page, the add-drink wizard and search (?with=id,id). */
export default function FlavorMapRoute() {
  return (
    <FeatureGate feature="flavorMap">
      <>
        <Stack.Screen options={{ headerShown: false, title: 'Flavor map' }} />
        <FlavorMapScreen />
      </>
    </FeatureGate>
  );
}
