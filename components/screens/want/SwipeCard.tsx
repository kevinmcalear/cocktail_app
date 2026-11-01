import * as Haptics from 'expo-haptics';
import { useImperativeHandle, type Ref } from 'react';
import { Platform, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Body, Caption, DrinkImage, DsText, Tag, useDs } from '@/components/ds';
import { font, radius, space, springs } from '@/constants/tokens';
import type { DeckCard } from '@/hooks/useWant';
import { swipeOutcome, type Swipe } from '@/lib/want';

/** The card, as the board draws it: 430 tall with a 260 picture. */
export const CARD_HEIGHT = 430;
const PICTURE = 260;
/** How far a let-go card turns at the edge of its width. */
const TILT = 8;
const LEAVE = { duration: 220, easing: Easing.in(Easing.cubic) };

export interface SwipeCardHandle {
  /** Send the card off one way (the buttons and the arrow keys), then report it. */
  fling: (swipe: Swipe) => void;
}

interface SwipeCardProps {
  card: DeckCard;
  /** "92% match", when there's a taste to match. */
  match: string | null;
  onSwipe: (swipe: Swipe) => void;
  ref?: Ref<SwipeCardHandle>;
}

/**
 * One drink to Want or not (Next-phone "swipe"): drag right for Want, left
 * for Not for me; a short drag springs back. A green "Want" or a "Not for
 * me" tag shows which way it's going. Screen readers get both as actions,
 * and the buttons under it do the same. Key it by the drink, so each card
 * starts in the middle.
 */
export function SwipeCard({ card, match, onSwipe, ref }: SwipeCardProps) {
  const ds = useDs();
  const x = useSharedValue(0);
  const width = useSharedValue(360);

  const done = (swipe: Swipe) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onSwipe(swipe);
  };
  const fling = (swipe: Swipe) => {
    x.set(withTiming((swipe === 'want' ? 1.5 : -1.5) * width.get(), LEAVE, (finished) => finished && scheduleOnRN(done, swipe)));
  };
  useImperativeHandle(ref, () => ({ fling }));

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-16, 16])
    .onUpdate((e) => x.set(e.translationX))
    .onEnd((e) => {
      const out = swipeOutcome(e.translationX, e.velocityX, width.get());
      if (out) x.set(withTiming((out === 'want' ? 1.5 : -1.5) * width.get(), LEAVE, (finished) => finished && scheduleOnRN(done, out)));
      else x.set(withSpring(0, springs.snap));
    });

  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { rotate: `${(x.get() / Math.max(width.get(), 1)) * TILT}deg` }] }));
  const wantTag = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [0, width.get() * 0.2], [0, 1], 'clamp') }));
  const passTag = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-width.get() * 0.2, 0], [1, 0], 'clamp') }));

  const label = [card.name, match, card.description].filter(Boolean).join('. ');
  const onAction = (e: AccessibilityActionEvent) => fling(e.nativeEvent.actionName === 'want' ? 'want' : 'pass');

  return (
    <View style={styles.stack} onLayout={(e) => width.set(e.nativeEvent.layout.width)}>
      {/* The next card, peeking out from under this one. */}
      <View style={[styles.under, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]} />
      <GestureDetector gesture={pan}>
        <Animated.View
          accessible
          accessibilityLabel={label}
          accessibilityHint="Swipe right for Want, left for Not for me."
          accessibilityActions={[
            { name: 'want', label: 'Want' },
            { name: 'pass', label: 'Not for me' },
          ]}
          onAccessibilityAction={onAction}
          style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.line }, moving]}
        >
          <View style={styles.picture}>
            <DrinkImage itemId={card.itemId} accessibilityLabel="" aspectRatio={1} radius={0} priority="high" style={styles.fill} />
          </View>
          <View style={styles.top}>
            <View style={styles.tags}>
              <Animated.View style={wantTag}>
                <Tag label="Want" tone="success" />
              </Animated.View>
              <Animated.View style={[styles.passTag, passTag]}>
                <Tag label="Not for me" tone="outline" />
              </Animated.View>
            </View>
            {match ? <Caption style={styles.match}>{match}</Caption> : null}
          </View>
          <View style={styles.words}>
            <DsText variant="title" numberOfLines={1}>
              {card.name}
            </DsText>
            {card.description ? (
              <Body tone="muted" numberOfLines={2}>
                {card.description}
              </Body>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const INSET = 14;

const styles = StyleSheet.create({
  stack: { width: '100%', height: CARD_HEIGHT },
  under: { position: 'absolute', top: INSET, left: INSET, right: INSET, bottom: 0, borderRadius: radius.sheet, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  card: { position: 'absolute', top: 0, left: 0, right: 0, bottom: space.sm, borderRadius: radius.sheet, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  picture: { position: 'absolute', top: space.xxl, alignSelf: 'center', width: PICTURE, height: PICTURE },
  fill: { width: '100%', height: '100%' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: space.lg + space.xs },
  tags: { minHeight: space.xl },
  passTag: { position: 'absolute', top: 0, left: 0 },
  match: { ...font.medium },
  words: { position: 'absolute', left: space.lg + space.xs, right: space.lg + space.xs, bottom: space.xl, gap: space.xs },
});
