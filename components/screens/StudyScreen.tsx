import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, Headline, Surface, Tag, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { radius, space } from '@/constants/tokens';
import { useStudyDecks, type Deck } from '@/hooks/useStudyDecks';
import { knownCount, streak } from '@/lib/study';
import { useStudyProgress } from '@/store/useStudyProgress';

function DeckCard({ deck, primary }: { deck: Deck; primary: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const cards = useStudyProgress((s) => s.cards);
  const total = deck.cardIds.length;
  const known = knownCount(deck.cardIds, cards);
  return (
    <Surface style={styles.deck}>
      <View style={styles.deckHead}>
        <Headline role="heading">{deck.title}</Headline>
        <Caption tone="muted">{total ? `${known} of ${total} known` : 'Empty'}</Caption>
      </View>
      <Body tone="muted">{deck.description}</Body>
      {total ? (
        <View style={[styles.bar, { backgroundColor: ds.c.line }]} aria-hidden>
          <View style={{ flex: known, backgroundColor: ds.accentText }} />
          <View style={{ flex: total - known }} />
        </View>
      ) : null}
      {total ? (
        <Button
          label={`Study ${total} ${total === 1 ? 'card' : 'cards'}`}
          variant={primary ? 'primary' : 'secondary'}
          onPress={() => router.push(`/study/${deck.id}` as never)}
          style={styles.start}
        />
      ) : deck.id === 'pile' ? (
        <Caption tone="muted">Add drinks with the book button on any drink.</Caption>
      ) : null}
    </Surface>
  );
}

/**
 * Study: learn the venue's drinks as flashcards, weakest first. Each role
 * studies what it can see: the spec on the back is masked like everywhere
 * else.
 */
export function StudyScreen() {
  const ds = useDs();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const { decks, isLoading } = useStudyDecks();
  const days = useStudyProgress((s) => s.days);
  const [today] = useState(() => new Date());
  const run = streak(days, today);
  const firstWithCards = decks.find((d) => d.cardIds.length)?.id;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <ScreenHeader />
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <Display>Study</Display>
          {run > 0 ? (
            <Tag label={`${run}-day streak`} tone="accent" />
          ) : (
            <Caption tone="muted">Study a few cards today to start a streak.</Caption>
          )}
          {isLoading ? <Caption tone="muted">Loading your decks…</Caption> : null}
          {decks.map((d) => (
            <DeckCard key={d.id} deck={d} primary={d.id === firstWithCards} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.lg, maxWidth: 760, width: '100%' },
  deck: { gap: space.sm },
  deckHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  bar: { flexDirection: 'row', height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  start: { alignSelf: 'flex-start', marginTop: space.xs },
});
