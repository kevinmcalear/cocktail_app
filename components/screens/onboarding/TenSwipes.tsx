import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Body, Button, Caption, DrinkDrawingFor, DsText, Tag, Title, useDs } from '@/components/ds';
import { displayFaces, drawing, radius, space } from '@/constants/tokens';
import type { DeckDrink } from '@/hooks/useWantDeck';
import { withAlpha } from '@/lib/color';
import { matchPercent, type Taste } from '@/lib/flavor';

/** How far a card goes before letting go answers it. */
const FLING = 110;
/** The board's card drawing, 260, from the 280 hero drawing. */
const ART = 260;

/**
 * One of the ten (board Loop-want, phone 3 "In onboarding"): the drink on its
 * colour with a card behind it, its match top right, its name and what's in
 * it; Not for me and Want under it, which do what a swipe does (left, right)
 * for Voice Control and the web, and the hint. FirstRunTaste draws the top
 * bar, with "3 of 10" as its title.
 */
export function SwipeCard({ drink, taste, onAnswer }: { drink: DeckDrink; taste: Taste; onAnswer: (want: boolean) => void }) {
  const ds = useDs();
  const x = useSharedValue(0);
  const match = drink.profile ? matchPercent(taste, drink.profile) : null;
  const answer = (want: boolean) => {
    x.set(0);
    onAnswer(want);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onChange((e) => x.set(x.get() + e.changeX))
    .onEnd(() => {
      const at = x.get();
      if (Math.abs(at) < FLING) return x.set(withSpring(0));
      x.set(withTiming(at > 0 ? 600 : -600, { duration: 180 }, () => scheduleOnRN(answer, at > 0)));
    });
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const wantTag = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, x.get() / FLING)) }));
  const label = `${drink.name}${match !== null ? `, ${match}% match` : ''}`;
  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <View style={[styles.behind, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]} />
        <GestureDetector gesture={pan}>
          <Animated.View
            role="img"
            accessibilityLabel={label}
            style={[styles.card, moving, { borderColor: ds.c.line, backgroundColor: ds.c.ground }]}
          >
            {/* Its colour over the paper, so the card behind doesn't show through. */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: drink.tint ? withAlpha(drink.tint, ds.scheme === 'dark' ? 0.28 : 0.2) : ds.c.surface }]} />
            <View style={styles.art}>
              <View style={{ transform: [{ scale: ART / drawing.hero }] }}>
                <DrinkDrawingFor itemId={drink.id} size="hero" pour={false} />
              </View>
            </View>
            <Animated.View style={[styles.tag, wantTag]}>
              <Tag label="Want" tone="success" />
            </Animated.View>
            {match !== null ? (
              <DsText variant="label" style={styles.match}>
                {`${match}% match`}
              </DsText>
            ) : null}
            <View style={styles.text}>
              <Title numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
                {drink.name}
              </Title>
              {drink.ingredients ? (
                <Body tone="muted" numberOfLines={2}>
                  {drink.ingredients}
                </Body>
              ) : null}
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
      <View style={styles.buttons}>
        <Button label="Not for me" variant="secondary" onPress={() => answer(false)} style={styles.flex} />
        <Button label="Want" variant="ink" onPress={() => answer(true)} style={styles.flex} />
      </View>
      <Caption tone="muted" align="center">
        Swipe right for Want, left for Not for me.
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  // The board: the card 420 tall over one 410 tall, inset 14, in a 430 block.
  stage: { height: 430 },
  behind: { position: 'absolute', left: 14, right: 14, top: 14, height: 410, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  card: { height: 420, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  art: { position: 'absolute', left: 0, right: 0, top: 34, height: ART, alignItems: 'center', justifyContent: 'center' },
  tag: { position: 'absolute', left: 22, top: 22 },
  match: { position: 'absolute', right: 20, top: 22, textAlign: 'right' },
  text: { position: 'absolute', left: 22, right: 22, bottom: 22, gap: space.xs },
  buttons: { flexDirection: 'row', gap: space.sm + 2, paddingTop: space.sm + 2 },
  flex: { flex: 1 },
});
