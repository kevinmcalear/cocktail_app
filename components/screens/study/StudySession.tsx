import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, DrinkImage, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { SpecSection } from '@/components/screens/drink/SpecSection';
import { radius, space } from '@/constants/tokens';
import type { Deck, StudyCardData } from '@/hooks/useStudyDecks';
import { glassOptions, orderDeck, type GlassOption, type Rating } from '@/lib/study';
import { useStudyProgress } from '@/store/useStudyProgress';

import { GlassQuestion } from './GlassQuestion';

const RATINGS: { rating: Rating; label: string; hint: string }[] = [
  { rating: 'again', label: 'Again', hint: 'You’ll see it first next time' },
  { rating: 'close', label: 'Close', hint: 'Almost had it' },
  { rating: 'nailed', label: 'Nailed it', hint: 'You know this one' },
];

interface StudySessionProps {
  deck: Deck;
  cards: Record<string, StudyCardData>;
  glasses: GlassOption[];
}

/** One deck, one card at a time: guess the glass, reveal the spec, rate yourself. */
export function StudySession({ deck, cards, glasses }: StudySessionProps) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const progress = useStudyProgress((s) => s.cards);
  const rate = useStudyProgress((s) => s.rate);
  // The order is fixed for the session so rating a card doesn't reshuffle it.
  const [order, setOrder] = useState(() => orderDeck(deck.cardIds, progress));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState<Record<Rating, number>>({ again: 0, close: 0, nailed: 0 });

  // On a cold load the deck can fill in after the first render.
  if (order.length === 0 && deck.cardIds.length > 0) setOrder(orderDeck(deck.cardIds, progress));

  const close = () => (router.canGoBack() ? router.back() : router.replace('/test' as never));
  const card = cards[order[index]];
  const done = order.length > 0 && index >= order.length;

  const onRate = (rating: Rating) => {
    if (Platform.OS !== 'web' && rating === 'nailed') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    rate(card.id, rating);
    setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
    setIndex((i) => i + 1);
    setPicked(null);
    setRevealed(false);
  };

  const restart = () => {
    setOrder(orderDeck(deck.cardIds, useStudyProgress.getState().cards));
    setIndex(0);
    setTally({ again: 0, close: 0, nailed: 0 });
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton accessibilityLabel="Close study" icon="xmark" onPress={close} />
        <Caption tone="muted">{done ? deck.title : `${deck.title} · ${index + 1} of ${order.length}`}</Caption>
      </View>
      <View style={[styles.progress, { marginHorizontal: gutter }]} aria-hidden>
        {order.map((id, i) => (
          <View key={id} style={[styles.segment, { backgroundColor: i < index ? ds.accentText : ds.c.line }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}>
        {done ? (
          <View style={styles.summary}>
            <Title>Deck done</Title>
            <Body tone="muted">
              {tally.nailed} nailed, {tally.close} close, {tally.again} to see again.
            </Body>
            <View style={styles.row}>
              <Button label="Study again" onPress={restart} />
              <Button label="Back to Study" variant="secondary" onPress={close} />
            </View>
          </View>
        ) : card ? (
          <View style={styles.card}>
            <Title>{card.name}</Title>
            {card.glass ? (
              <GlassQuestion options={glassOptions(card.glass, glasses, card.id)} correctId={card.glass.id} picked={picked} onPick={setPicked} />
            ) : null}
            {/* The picture shows the glass, so it waits for the answer. */}
            {!card.glass || picked !== null || revealed ? (
              <DrinkImage source={card.imageUrl} glass={card.glass?.icon ?? null} accessibilityLabel={card.name} aspectRatio={4 / 3} />
            ) : null}
            {revealed ? (
              <SpecSection itemId={card.id} barId={card.barId} recipes={card.recipes} scale={1} />
            ) : (
              <Button
                label="Show the spec"
                variant={card.glass && picked === null ? 'secondary' : 'primary'}
                onPress={() => setRevealed(true)}
                style={styles.reveal}
              />
            )}
            {revealed ? (
              <View style={styles.rates} role="group" accessibilityLabel="How well did you know it?">
                {RATINGS.map((r) => (
                  <Button
                    key={r.rating}
                    label={r.label}
                    accessibilityHint={r.hint}
                    variant={r.rating === 'nailed' ? 'primary' : 'secondary'}
                    onPress={() => onRate(r.rating)}
                    style={styles.rate}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <Body tone="muted">Nothing to study in this deck yet.</Body>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  progress: { flexDirection: 'row', gap: 3, marginTop: space.md },
  segment: { flex: 1, height: 4, borderRadius: radius.pill },
  body: { paddingTop: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  card: { gap: space.lg },
  reveal: { alignSelf: 'flex-start' },
  rates: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rate: { flexGrow: 1 },
  summary: { gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
