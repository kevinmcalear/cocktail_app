import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { DsText, useDs } from '@/components/ds';
import { displayFaces, eightBall } from '@/constants/tokens';

const BALL = 260;
const WINDOW = 150;

/** Long names step down a size so they stay inside the triangle (web can't shrink text to fit). */
const fit = (text: string) => (text.length > 18 ? 'caption' : text.length > 10 ? 'body' : 'headline');

/**
 * The ball itself, as the Shake design draws it: a lit black sphere, an
 * ink-blue window ringed in the accent, and the triangle with the answer in
 * the venue's display face. `wobble` (-1 to 1) rocks the ball; `rise` (0 to
 * 1) brings the triangle's words up. Still with Reduce Motion: only fades.
 */
export function BallArt({ text, wobble, rise, still }: { text: string; wobble: SharedValue<number>; rise: SharedValue<number>; still: boolean }) {
  const ds = useDs();
  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: wobble.get() * 18 }, { rotate: `${wobble.get() * 9}deg` }],
  }));
  const riseStyle = useAnimatedStyle(() => ({ opacity: rise.get(), transform: [{ translateY: still ? 0 : (1 - rise.get()) * 10 }] }));
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
      <View style={[styles.window, { backgroundColor: eightBall.window }]}>
        <View style={[styles.ring, { borderColor: ds.accentText }]} />
        <Svg width={120} height={104} viewBox="0 0 120 104">
          <Path d="M60 98 L6 6 L114 6 Z" fill={eightBall.triangle} stroke={ds.accentText} strokeWidth={1.5} />
        </Svg>
        <Animated.View style={[styles.answer, riseStyle]}>
          <DsText variant={fit(text)} align="center" numberOfLines={3} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
            {text}
          </DsText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ball: { width: BALL, height: BALL, alignItems: 'center', justifyContent: 'center' },
  window: { width: WINDOW, height: WINDOW, borderRadius: WINDOW / 2, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: WINDOW / 2, borderWidth: 2, opacity: 0.35 },
  // The triangle points down, so the words sit in its wide top half.
  answer: { position: 'absolute', top: 30, width: 96, height: 64, alignItems: 'center', justifyContent: 'center' },
});
