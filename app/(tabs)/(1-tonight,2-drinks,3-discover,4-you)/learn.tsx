import { Stack } from 'expo-router';

import { LearnScreen } from '@/components/screens/learn/LearnScreen';
import { FeatureGate } from '@/components/nav/FeatureGate';
import { TechniquesGate } from '@/components/techniques/TechniquesGate';

/** Learn (Kept-learn): techniques, kit and pairings, on the stack of the tab it opened from (Discover, or Tonight for staff). */
export default function LearnRoute() {
  return (
    <FeatureGate feature="techniques">
      <TechniquesGate>
        <Stack.Screen options={{ headerShown: false, title: 'Learn' }} />
        <LearnScreen />
      </TechniquesGate>
    </FeatureGate>
  );
}
