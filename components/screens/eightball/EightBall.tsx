import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { BackbarTheme, Body, Button, Caption, DrinkImage, GlassButton, Headline, Title, useDs } from '@/components/ds';
import { radius, space, springs } from '@/constants/tokens';
import { useEightBallPool } from '@/hooks/useEightBall';
import { FORTUNES, pickDrink, RECENT, type Candidate } from '@/lib/eightBall';
import { itemHref } from '@/lib/itemRoutes';

const BALL = 220;
/** How long the ball "thinks" before it answers. */
const THINK_MS = 1100;
const native = Platform.OS !== 'web';

type Answer = { state: 'thinking'; fortune: string } | { state: 'shown'; drink: Candidate | null };

const randomFortune = () => FORTUNES[Math.floor(Math.random() * FORTUNES.length)];

/**
 * The magic eight ball (issue #18): the ball wobbles, its window turns up a
 * fortune, and a drink rises out of it with Another and Open. Shaking again
 * (routed in by EightBallProvider through `rollRef`) is Another. With Reduce
 * Motion on, nothing moves: the answer fades in.
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
  const reduceMotion = useReducedMotion();
  const { pool, isLoading } = useEightBallPool();
  const [answer, setAnswer] = useState<Answer>(() => ({ state: 'thinking', fortune: randomFortune() }));
  const latest = useRef({ pool, isLoading });
  const recent = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wobble = useSharedValue(0);
  const face = useSharedValue(0); // 0: the "8"; 1: the window with its answer
  const card = useSharedValue(0);

  useEffect(() => {
    latest.current = { pool, isLoading };
  });

  // Waits out the think time and the pool, then answers.
  function reveal() {
    if (latest.current.isLoading) {
      timer.current = setTimeout(reveal, 250);
      return;
    }
    const drink = pickDrink(latest.current.pool, recent.current);
    if (drink) recent.current = [drink.id, ...recent.current].slice(0, RECENT);
    setAnswer({ state: 'shown', drink });
    card.set(reduceMotion ? withTiming(1, { duration: 200 }) : withSpring(1, springs.pour));
    if (native) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility(drink ? `${drink.name}. ${drink.reason ?? ''}` : 'No drinks yet');
    }
  }

  function think() {
    if (timer.current) clearTimeout(timer.current);
    card.set(reduceMotion ? withTiming(0, { duration: 150 }) : withSpring(0, springs.snap));
    if (reduceMotion) {
      face.set(withTiming(1, { duration: 200 }));
    } else {
      // A jolt, then the pour spring rings it out like a ball settling in the hand.
      wobble.set(withSequence(withTiming(1, { duration: 70 }), withSpring(0, springs.pour)));
      face.set(withSequence(withTiming(0, { duration: 120 }), withSpring(1, springs.pour)));
    }
    if (native) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    timer.current = setTimeout(reveal, reduceMotion ? 300 : THINK_MS);
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

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: wobble.get() * 18 }, { rotate: `${wobble.get() * 9}deg` }],
  }));
  const eightStyle = useAnimatedStyle(() => ({ opacity: 1 - face.get(), transform: [{ scale: 1 - face.get() * 0.3 }] }));
  const windowStyle = useAnimatedStyle(() => ({ opacity: face.get(), transform: [{ translateY: (1 - face.get()) * 14 }] }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: card.get(), transform: [{ translateY: reduceMotion ? 0 : (1 - card.get()) * 32 }] }));

  const drink = answer.state === 'shown' ? answer.drink : null;
  const open = () => {
    if (!drink) return;
    onClose();
    router.push(itemHref('Cocktail', drink.id) as never);
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.scrim }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close the eight ball" />
      <View style={styles.close}>
        <GlassButton icon="xmark" accessibilityLabel="Close" onPress={onClose} />
      </View>
      <View style={styles.stack} pointerEvents="box-none">
        <Animated.View style={[styles.ball, { backgroundColor: ds.c.ground, borderColor: ds.c.lineStrong }, ballStyle]}>
          <View style={[styles.shine, { backgroundColor: ds.c.ink }]} />
          <Animated.View style={[styles.eight, { backgroundColor: ds.c.paper }, eightStyle]}>
            <Title color={ds.c.sketchInk}>8</Title>
          </Animated.View>
          <Animated.View style={[styles.window, { backgroundColor: ds.c.raised }, windowStyle]}>
            <View style={[styles.triangle, { borderBottomColor: ds.c.surface }]} />
            <Caption style={styles.fortune} numberOfLines={3}>
              {answer.state === 'thinking' ? answer.fortune : drink ? drink.name : 'Ask again later'}
            </Caption>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }, cardStyle]} aria-live="polite">
          {answer.state === 'thinking' ? null : drink ? (
            <>
              <View style={styles.row}>
                <View style={styles.thumb}>
                  <DrinkImage source={drink.imageUrl} glass={drink.glass} itemId={drink.id} accessibilityLabel={drink.name} radius="control" hideTag />
                </View>
                <View style={styles.text}>
                  <Headline numberOfLines={2}>{drink.name}</Headline>
                  {drink.reason ? <Caption tone="muted">{drink.reason}</Caption> : null}
                </View>
              </View>
              <View style={styles.actions}>
                <Button label="Another" icon="arrow.clockwise" variant="secondary" onPress={roll} style={styles.action} />
                <Button label="Open" onPress={open} style={styles.action} />
              </View>
            </>
          ) : (
            <Body tone="muted">No drinks to pick from yet. Add a few bottles to My Bar or save some drinks, then ask again.</Body>
          )}
        </Animated.View>
        {native ? <Caption tone="muted">Shake again for another</Caption> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  close: { position: 'absolute', top: space.xxxl + space.lg, right: space.lg },
  stack: { alignItems: 'center', gap: space.xl, width: '100%', maxWidth: 420 },
  ball: {
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shine: { position: 'absolute', top: BALL * 0.1, left: BALL * 0.18, width: BALL * 0.28, height: BALL * 0.16, borderRadius: BALL, opacity: 0.12, transform: [{ rotate: '-30deg' }] },
  eight: { position: 'absolute', width: BALL * 0.42, height: BALL * 0.42, borderRadius: BALL, alignItems: 'center', justifyContent: 'center' },
  window: { position: 'absolute', width: BALL * 0.56, height: BALL * 0.56, borderRadius: BALL, alignItems: 'center', justifyContent: 'center' },
  triangle: {
    position: 'absolute',
    top: BALL * 0.08,
    width: 0,
    height: 0,
    borderLeftWidth: BALL * 0.24,
    borderRightWidth: BALL * 0.24,
    borderBottomWidth: BALL * 0.38,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  fortune: { textAlign: 'center', width: BALL * 0.3, marginTop: BALL * 0.06 },
  card: { width: '100%', borderRadius: radius.card, borderWidth: 1, borderCurve: 'continuous', padding: space.lg, gap: space.lg, minHeight: 148 },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  thumb: { width: 72 },
  text: { flex: 1, gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
