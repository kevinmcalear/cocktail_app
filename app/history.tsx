import { Stack } from 'expo-router';

import { HistoryScreen } from '@/components/screens/history/HistoryScreen';

/** Every classic's family tree. Opened from a drink's Family tree (?focus=id) and from Search. */
export default function HistoryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Cocktail history' }} />
      <HistoryScreen />
    </>
  );
}
