import { Stack, useLocalSearchParams } from 'expo-router';

import { ScoreHistoryScreen } from '@/components/screens/scores/ScoreHistoryScreen';

/** A bar drink's score and its history (Red-score), from the score on its page. */
export default function ScoreRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Score' }} />
      <ScoreHistoryScreen itemId={itemId} />
    </>
  );
}
