import { Stack } from 'expo-router';

import { HistoryScreen } from '@/components/screens/history/HistoryScreen';
import { FeatureGate } from '@/components/nav/FeatureGate';

/** Every classic's family tree. Opened from a drink's Family tree (?focus=id) and from Search. */
export default function HistoryRoute() {
  return (
    <FeatureGate feature="history">
      <>
        <Stack.Screen options={{ headerShown: false, title: 'Cocktail history' }} />
        <HistoryScreen />
      </>
    </FeatureGate>
  );
}
