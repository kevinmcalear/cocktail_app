import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { StudySession } from '@/components/screens/study/StudySession';
import { useStudyDecks } from '@/hooks/useStudyDecks';

/**
 * A study session for one deck: /study/tonight, /study/pile, /study/venue.
 * `?drink=<id>` runs through that one card (Tonight's Learn rows).
 */
export default function StudyRoute() {
  const { deck: deckId, drink } = useLocalSearchParams<{ deck: string; drink?: string }>();
  const { decks, cards, glasses, isLoading } = useStudyDecks();
  const whole = decks.find((d) => d.id === deckId);
  const deck = whole && drink && whole.cardIds.includes(drink) ? { ...whole, cardIds: [drink] } : whole;
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Study' }} />
      {deck && !isLoading ? <StudySession key={`${deck.id}-${drink ?? ''}`} deck={deck} cards={cards} glasses={glasses} /> : null}
    </VenueBrandProvider>
  );
}
