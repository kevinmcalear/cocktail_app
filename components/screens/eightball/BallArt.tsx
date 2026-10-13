import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { DsText, useDs } from '@/components/ds';
import { displayFaces, eightBall } from '@/constants/tokens';
import type { Roll } from '@/lib/eightBallRoll';

export const BALL = 260;
const WINDOW = 150;

/** Long names step down a size so they stay inside the triangle (web can't shrink text to fit). */
const fit = (text: string) => (text.length > 14 ? 'caption' : text.length > 8 ? 'body' : 'headline');

/**
 * The ball itself, as the Shake design draws it: a lit black sphere, an
 * ink-blue window ringed in the accent, and the triangle with the answer in
 * the venue's display face. `wobble` (-1 to 1) rocks the ball; `rise` (0 to
 * 1) floats the die (triangle and words) up out of the liquid, turning as it
 * comes. `roll` (useRollingBall) turns the window as the ball rolls, and the
 * die trails, sinks and wobbles with it. The lit body never turns, so the
 * shine stays put. Still with Reduce Motion: only fades.
 */
export function BallArt({ text, wobble, rise, roll, still }: { text: string; wobble: SharedValue<number>; rise: SharedValue<number>; roll: SharedValue<Roll>; still: boolean }) {
  const ds = useDs();
  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: wobble.get() * 18 }, { rotate: `${wobble.get() * 9}deg` }],
  }));
  const windowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${roll.get().spin}rad` }] }));
  const dieStyle = useAnimatedStyle(() => {
    const up = rise.get();
    const { dieX, dieY, depth } = roll.get();
    if (still) return { opacity: up };
    const sunk = 1 - up;
    return {
      opacity: up * (1 - depth * 0.7),
      transform: [
        { translateX: dieX },
        { translateY: dieY + sunk * 26 + depth * 14 },
        { rotate: `${dieX * 1.4 - sunk * 14}deg` },
        { scale: (0.84 + up * 0.16) * (1 - depth * 0.18) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.ball, ballStyle]} aria-hidden>
      <Svg width={BALL} height={BALL} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="ball" cx="35%" cy="30%" r="75%">
            <Stop offset="0" stopColor={eightBall.shine} />
            <Stop offset="0.62" stopColor={eightBall.body} />
            <Stop offset="1" stopColor={eightBall.edge} />
          </RadialGradient>
        </Defs>
        <Rect width={BALL} height={BALL} rx={BALL / 2} fill="url(#ball)" />
      </Svg>
      <Animated.View style={[styles.window, { backgroundColor: eightBall.window }, windowStyle]}>
        <Animated.View style={[styles.die, dieStyle]}>
          <Svg width={120} height={104} viewBox="0 0 120 104">
            <Path d="M60 98 L6 6 L114 6 Z" fill={eightBall.triangle} stroke={ds.accentText} strokeWidth={1.5} />
          </Svg>
          <View style={styles.answer}>
            <DsText variant={fit(text)} align="center" numberOfLines={3} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
              {text}
            </DsText>
          </View>
        </Animated.View>
        <View style={[styles.ring, { borderColor: ds.accentText }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ball: { width: BALL, height: BALL, alignItems: 'center', justifyContent: 'center' },
  // Clips the die as it sinks and drifts in the liquid.
  window: { width: WINDOW, height: WINDOW, borderRadius: WINDOW / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  die: { width: 120, height: 104, alignItems: 'center' },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: WINDOW / 2, borderWidth: 2, opacity: 0.35 },
  // The triangle points down, so the words hang from its wide top edge.
  answer: { position: 'absolute', top: 11, width: 84, alignItems: 'center' },
});
