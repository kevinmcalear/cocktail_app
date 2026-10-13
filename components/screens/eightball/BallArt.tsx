import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { eightBall } from '@/constants/tokens';
import type { Pose } from '@/lib/eightBallFace';
import type { Roll } from '@/lib/eightBallRoll';

import { DieFace } from './DieFace';
import { EightSide } from './EightSide';

export const BALL = 260;
const WINDOW = 150;
/** How far a side travels across the ball as it turns away. */
const TURN_REACH = 118;

/**
 * The ball, like the real toy (Kevin, 13 Oct 2026): a lit black sphere, a
 * black window with a clear rim, and one glowing blue face of the die inside
 * (DieFace) with the answer in small capitals. `wobble` (-1 to 1) rocks the
 * ball; `rise` (0 to 1) floats the die up out of the murk, turning over as it
 * comes and lighting up as it reaches the glass, to rest the way `pose` says
 * (pointing up or down, a little tilted and off centre, as the real one
 * lands). `roll` (useRollingBall) turns the window as the ball rolls, and the
 * die trails, sinks and wobbles with it. `turn` (0 to 1) turns the ball over
 * to its white 8 side and back, the way you hold the toy while you ask:
 * each side slides towards the edge, narrowing, and slips behind the sphere.
 * The lit body never turns, so the shine stays put. Still with Reduce
 * Motion: the face only fades, and the window stays in front.
 */
export function BallArt({
  text,
  pose,
  wobble,
  rise,
  roll,
  turn,
  still,
}: {
  text: string;
  pose: Pose;
  wobble: SharedValue<number>;
  rise: SharedValue<number>;
  roll: SharedValue<Roll>;
  turn: SharedValue<number>;
  still: boolean;
}) {
  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: wobble.get() * 18 }, { rotate: `${wobble.get() * 9}deg` }],
  }));
  // Half a turn of the sphere: the window side faces you at 0, the 8 side at 1.
  const windowSideStyle = useAnimatedStyle(() => {
    const a = turn.get() * Math.PI;
    const facing = Math.cos(a);
    return { opacity: Math.min(1, Math.max(0, facing * 4)), transform: [{ translateX: Math.sin(a) * TURN_REACH }, { scaleX: Math.max(0.01, facing) }] };
  });
  const eightSideStyle = useAnimatedStyle(() => {
    const a = turn.get() * Math.PI;
    const facing = -Math.cos(a);
    return { opacity: Math.min(1, Math.max(0, facing * 4)), transform: [{ translateX: -Math.sin(a) * TURN_REACH }, { scaleX: Math.max(0.01, facing) }] };
  });
  const windowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${roll.get().spin}rad` }] }));
  const dieStyle = useAnimatedStyle(() => {
    const up = rise.get();
    if (still) return { opacity: up, transform: [{ translateX: pose.dx }, { translateY: pose.dy }, { rotate: `${pose.tilt}deg` }] };
    const { dieX, dieY, depth } = roll.get();
    const sunk = 1 - up;
    return {
      // Dim in the murk; it lights up as it presses against the glass.
      opacity: Math.pow(Math.max(0, up), 1.6) * (1 - depth * 0.75),
      transform: [
        { perspective: 600 },
        { translateX: dieX + pose.dx },
        { translateY: dieY + pose.dy + sunk * 28 + depth * 14 },
        // Turning over as it rises: tipped back, then square to the window.
        { rotateX: `${sunk * 70}deg` },
        { rotate: `${pose.tilt + pose.turnIn * sunk + dieX * 1.4}deg` },
        { scale: (0.8 + up * 0.2) * (1 - depth * 0.18) },
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
      {/* The sides turn within the ball's outline, slipping behind it at the edge. */}
      <View style={styles.sphere}>
        <Animated.View style={[styles.side, eightSideStyle]}>
          <EightSide />
        </Animated.View>
        <Animated.View style={[styles.side, windowSideStyle]}>
          <Animated.View style={[styles.window, { backgroundColor: eightBall.window }, windowStyle]}>
            <Animated.View style={dieStyle}>
              <DieFace text={text} up={pose.up} />
            </Animated.View>
            {/* The murk: the liquid darkens towards the rim, so the face looks submerged. */}
            <Svg width={WINDOW} height={WINDOW} style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="eightBallMurk" cx="50%" cy="50%" r="50%">
                  <Stop offset="0.45" stopColor={eightBall.window} stopOpacity={0} />
                  <Stop offset="1" stopColor={eightBall.window} stopOpacity={0.95} />
                </RadialGradient>
              </Defs>
              <Rect width={WINDOW} height={WINDOW} fill="url(#eightBallMurk)" />
            </Svg>
          </Animated.View>
          {/* The window's clear rim and the shine on it don't spin with the rolling window. */}
          <View style={styles.glass}>
            <Svg width={WINDOW + 12} height={WINDOW + 12}>
              <Circle cx={WINDOW / 2 + 6} cy={WINDOW / 2 + 6} r={WINDOW / 2 + 3} stroke={eightBall.rim} strokeWidth={6} fill="none" />
              <Path d="M30 64 A52 52 0 0 1 66 30" stroke={eightBall.glass} strokeOpacity={0.09} strokeWidth={5} strokeLinecap="round" fill="none" />
            </Svg>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ball: { width: BALL, height: BALL, alignItems: 'center', justifyContent: 'center' },
  // Clips the die as it sinks and drifts in the liquid.
  window: { width: WINDOW, height: WINDOW, borderRadius: WINDOW / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sphere: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: BALL / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  side: { position: 'absolute', width: WINDOW + 12, height: WINDOW + 12, alignItems: 'center', justifyContent: 'center' },
  glass: { position: 'absolute', left: 0, top: 0 },
});
