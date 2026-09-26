import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { StudySession } from '@/components/screens/study/StudySession';
import { useStudyDecks } from '@/hooks/useStudyDecks';
import { useRedesign } from '@/lib/flags';

/** A study session for one deck: /study/tonight, /study/pile, /study/venue. */
export default function StudyDeck() {
  const { deck: deckId } = useLocalSearchParams<{ deck: string }>();
  const redesign = useRedesign();
  const { decks, cards, glasses, isLoading } = useStudyDecks();
  if (!redesign) return <Redirect href="/test" />;
  const deck = decks.find((d) => d.id === deckId);
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Study' }} />
      {deck && !isLoading ? <StudySession key={deck.id} deck={deck} cards={cards} glasses={glasses} /> : null}
    </VenueBrandProvider>
  );
}
