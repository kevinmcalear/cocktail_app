import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, Headline, useDs, useGutter } from '@/components/ds';
import { SignInCard } from '@/components/screens/published/SignInCard';
import { useAgeGate } from '@/components/screens/safety/AgeGate';
import { layout, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useWantDeck, useWantMatches, useWantSwipe, type DeckCard } from '@/hooks/useWant';
import type { Swipe } from '@/lib/want';

import { SwipeCard, type SwipeCardHandle } from './SwipeCard';
import { SwipeEnd } from './SwipeEnd';

export interface WantSwipeProps {
  /** Onboarding's step (back, "3 of 10", "That's ten"); else Want it? from the Want list or a drink. */
  onboarding?: boolean;
  /** Cards to swipe before the end: onboarding's ten. Else the whole deck. */
  count?: number;
  /** After Done (or Start in onboarding). Default: back. */
  onDone?: () => void;
}

/** The column a phone shows, centred on wider screens. */
const COLUMN = 480;

/**
 * Want it? (Loop-want, Next-phone "swipe"): one classic at a time, swipe
 * right for Want (onto the Want list) or left for Not for me (the deck skips
 * it from now on). The buttons and, on the web, the arrow keys do the same.
 * At the end, what you wanted and where it's on near you.
 */
export function WantSwipeScreen(props: WantSwipeProps) {
  return (
    <BackbarTheme>
      <SwipePage {...props} />
    </BackbarTheme>
  );
}

function SwipePage({ onboarding = false, count, onDone }: WantSwipeProps) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const signedIn = useSignedIn();
  const deck = useWantDeck(count ? Math.max(count, 1) : 20);
  const cards = (deck.data ?? []).slice(0, count ?? undefined);
  const { matchFor, taste } = useWantMatches(cards.map((c) => c.itemId));
  const swipe = useWantSwipe();
  const age = useAgeGate();
  const [at, setAt] = useState(0);
  const [wanted, setWanted] = useState<DeckCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<SwipeCardHandle>(null);
  const card = cards[at] ?? null;
  const ended = !!deck.data && !card;

  const close = onDone ?? (() => (router.canGoBack() ? router.back() : router.replace('/want')));
  const save = (c: DeckCard, s: Swipe) =>
    swipe.mutate({ itemId: c.itemId, swipe: s }, { onError: () => setError(`Couldn’t save ${c.name}. It’ll come round again.`) });

  const onSwipe = (s: Swipe) => {
    if (!card) return;
    setError(null);
    setAt(at + 1);
    if (s === 'pass') return save(card, s);
    // A Want needs a confirmed age (the database refuses it otherwise); without one, the drink comes round again.
    if (age.underAge) return setError('Wanting drinks needs you to be of drinking age where you live.');
    age.gate(() => {
      save(card, s);
      setWanted((w) => [...w, card]);
    });
  };

  // The arrow keys swipe on the web.
  useEffect(() => {
    if (Platform.OS !== 'web' || !card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') cardRef.current?.fling('want');
      if (e.key === 'ArrowLeft') cardRef.current?.fling('pass');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card]);

  const title = ended ? '' : onboarding && count ? `${Math.min(at + 1, count)} of ${count}` : 'Want it?';

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.column}>
          {!signedIn ? (
            <SignInCard title="Want it?" text="Sign in to swipe drinks onto your Want list, and hear when one is on near you." replace />
          ) : deck.error ? (
            <Body tone="muted">Couldn’t load drinks to swipe. Pull back and try again.</Body>
          ) : !deck.data ? (
            <ActivityIndicator style={styles.loading} color={ds.c.muted} accessibilityLabel="Loading drinks" />
          ) : ended ? (
            <SwipeEnd wanted={wanted} onboarding={onboarding} taste={taste} onDone={close} />
          ) : (
            <>
              <SwipeCard key={card!.itemId} ref={cardRef} card={card!} match={matchFor(card!.itemId)} onSwipe={onSwipe} />
              <View style={styles.buttons}>
                <Button label="Not for me" variant="secondary" style={styles.flex} onPress={() => cardRef.current?.fling('pass')} />
                <Button label="Want" variant="ink" style={styles.flex} onPress={() => cardRef.current?.fling('want')} />
              </View>
              <Caption tone="muted" align="center">
                Swipe right for Want, left for Not for me.
              </Caption>
            </>
          )}
          {error ? (
            <Caption tone="muted" align="center" role="alert">
              {error}
            </Caption>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.top, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
        <GlassButton accessibilityLabel={onboarding ? 'Back' : 'Close'} icon={onboarding ? 'chevron.left' : 'xmark'} onPress={close} />
        {title ? (
          <Headline role="heading" style={styles.title} numberOfLines={1}>
            {title}
          </Headline>
        ) : null}
        <View style={styles.side} />
      </View>
      {age.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center', gap: space.md },
  loading: { marginTop: space.xxxl },
  buttons: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  flex: { flex: 1 },
  top: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, textAlign: 'center' },
  side: { width: layout.minTapTarget },
});
