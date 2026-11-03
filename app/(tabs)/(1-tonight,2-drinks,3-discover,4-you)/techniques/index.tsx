import { Stack, useLocalSearchParams } from 'expo-router';

import { TechniquesScreen } from '@/components/screens/techniques/TechniquesScreen';
import { FeatureGate } from '@/components/nav/FeatureGate';

/** The technique library. `?group=clarify` opens one group (from a prep card's tag); `?search=1` opens with the search field focused (Learn's Search). */
export default function TechniquesRoute() {
  const { group, search } = useLocalSearchParams<{ group?: string; search?: string }>();
  return (
    <FeatureGate feature="techniques">
      <>
        <Stack.Screen options={{ headerShown: false, title: 'Techniques' }} />
        <TechniquesScreen group={group} search={search === '1'} />
      </>
    </FeatureGate>
  );
}
