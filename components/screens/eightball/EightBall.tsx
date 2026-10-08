import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Modal, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, Title, useDs } from '@/components/ds';
import { space, springs } from '@/constants/tokens';
import { useEightBallPool } from '@/hooks/useEightBall';
import { FORTUNES, makeA, pickDrink, RECENT, type Candidate } from '@/lib/eightBall';
import { itemHref } from '@/lib/itemRoutes';

import { BallArt } from './BallArt';
import { usePrefetchCocktail } from '@/hooks/useCocktails';

/** How long the ball "thinks" before it answers. */
const THINK_MS = 1100;
/** After thinking, how long to wait on a slow shelf before answering from the rest of the pool. */
const MAX_WAIT_MS = 1500;
const POLL_MS = 250;
const native = Platform.OS !== 'web';

type Answer = { state: 'thinking'; fortune: string } | { state: 'shown'; drink: Candidate | null };

const randomFortune = () => FORTUNES[Math.floor(Math.random() * FORTUNES.length)];

/**
 * The magic eight ball (issue #18), as the approved Shake design: the ball
 * wobbles, its window turns up a fortune, then the drink, with "Make a …",
 * why, and Another and Open recipe. Shaking again (routed in by
 * EightBallProvider through `rollRef`) is Another. With Reduce Motion on,
 * nothing moves: the answer fades in.
 */
export function EightBall({ onClose, rollRef }: { onClose: () => void; rollRef: RefObject<(() => void) | null> }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <BackbarTheme scheme="dark">
        <Ball onClose={onClose} rollRef={rollRef} />
      </BackbarTheme>
    </Modal>
  );
}

function Ball({ onClose, rollRef }: { onClose: () => void; rollRef: RefObject<(() => void) | null> }) {
  const ds = useDs();
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { pool, isLoading } = useEightBallPool();
  const [answer, setAnswer] = useState<Answer>(() => ({ state: 'thinking', fortune: randomFortune() }));
  const latest = useRef({ pool, isLoading });
  const recent = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wobble = useSharedValue(0);
  const rise = useSharedValue(0); // the triangle's words coming up
  const card = useSharedValue(0); // title, reason and buttons

  useEffect(() => {
    latest.current = { pool, isLoading };
  });

  const bringUp = (value: SharedValue<number>) =>
    value.set(reduceMotion ? withTiming(1, { duration: 200 }) : withSequence(withTiming(0, { duration: 90 }), withSpring(1, springs.pour)));

  // Waits out the think time and the pool (a slow shelf only so long), then answers.
  function reveal(waited = 0) {
    const { pool, isLoading } = latest.current;
    if (isLoading && (waited < MAX_WAIT_MS || !pool.length)) {
      timer.current = setTimeout(() => reveal(waited + POLL_MS), POLL_MS);
      return;
    }
    const drink = pickDrink(latest.current.pool, recent.current);
    if (drink) recent.current = [drink.id, ...recent.current].slice(0, RECENT);
    // Open recipe is a ds Button (no press-in): load the page as the answer shows.
    if (drink) prefetch(drink.id, { name: drink.name, imageUrl: drink.imageUrl });
    setAnswer({ state: 'shown', drink });
    bringUp(rise);
    bringUp(card);
    if (native) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Android and web read the live region; iOS needs telling.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(drink ? `${makeA(drink.name)}. ${drink.reason}` : 'Nothing to pick yet');
  }

  function think() {
    if (timer.current) clearTimeout(timer.current);
    card.set(withTiming(0, { duration: 150 }));
    bringUp(rise);
    // A jolt, then the pour spring rings it out like a ball settling in the hand.
    if (!reduceMotion) wobble.set(withSequence(withTiming(1, { duration: 70 }), withSpring(0, springs.pour)));
    if (native) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    timer.current = setTimeout(() => reveal(), reduceMotion ? 300 : THINK_MS);
  }

  function roll() {
    setAnswer({ state: 'thinking', fortune: randomFortune() });
    think();
  }

  useEffect(() => {
    rollRef.current = roll;
    return () => {
      rollRef.current = null;
    };
  });

  useEffect(() => {
    think();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // Once, as the ball opens; Another and shakes call roll().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = useAnimatedStyle(() => ({ opacity: card.get(), transform: [{ translateY: reduceMotion ? 0 : (1 - card.get()) * 24 }] }));

  const shown = answer.state === 'shown';
  const drink = shown ? answer.drink : null;
  const open = () => {
    if (!drink) return;
    onClose();
    router.push(itemHref('Cocktail', drink.id) as never);
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xxl }]}>
      <View style={[styles.close, { top: insets.top + space.sm }]}>
        <GlassButton icon="xmark" accessibilityLabel="Close" onPress={onClose} />
      </View>
      <View style={styles.column}>
        <Caption tone="muted" style={styles.eyebrow}>
          {shown ? 'THE BAR HAS SPOKEN' : 'ASKING THE BAR'}
        </Caption>
        <BallArt text={answer.state === 'thinking' ? answer.fortune : (drink?.name ?? 'Ask again later')} wobble={wobble} rise={rise} still={reduceMotion} />
        <Animated.View style={[styles.copy, cardStyle]} aria-live="polite">
          {shown ? (
            <>
              <Title align="center">{drink ? makeA(drink.name) : 'Nothing to pick yet'}</Title>
              <Body tone="muted" align="center">
                {drink ? drink.reason : 'Add a few bottles to My Bar or save some drinks, then ask again.'}
              </Body>
            </>
          ) : null}
        </Animated.View>
      </View>
      <Animated.View style={[styles.actions, cardStyle]} pointerEvents={shown ? 'auto' : 'none'}>
        <Button
          label="Another"
          icon="arrow.clockwise"
          variant="secondary"
          size="lg"
          onPress={roll}
          accessibilityHint={native ? 'Or shake your phone again' : undefined}
          style={styles.action}
        />
        {drink ? <Button label="Open recipe" size="lg" onPress={open} style={styles.action} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.xl, alignItems: 'center' },
  close: { position: 'absolute', right: space.lg, zIndex: 1 },
  column: { flex: 1, width: '100%', maxWidth: 420, alignItems: 'center', gap: space.xl },
  eyebrow: { letterSpacing: 0.8 },
  copy: { gap: space.sm, alignItems: 'center', marginTop: space.md, minHeight: 120 },
  actions: { flexDirection: 'row', gap: space.sm, width: '100%', maxWidth: 420 },
  action: { flex: 1 },
});
