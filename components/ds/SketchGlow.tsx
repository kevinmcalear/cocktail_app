import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { glowParts, glowScene, type GLOW_STAGES } from '@/lib/sketch/passes';
import type { Scene } from '@/lib/sketch/scene';
import { sceneToSvg } from '@/lib/sketch/svg';

type GlowStage = (typeof GLOW_STAGES)[number];
interface GlowPart {
  stage: GlowStage;
  uri: string;
}
/** When each part comes in, as a share of the drawing's time (AnimatedSketch's beats). */
export type GlowTimes = Record<GlowStage, { from: number; to: number }>;

const uriOf = (scene: Scene) => `data:image/svg+xml;base64,${btoa(sceneToSvg(scene))}`;

// Night's soft glow behind the drawing, per night scene: while it moves, one picture per part, each glowing in
// with its own stage (so the garnish's glow waits for the garnish to land); at rest, the one glow DrinkDrawing paints.
export interface GlowUris {
  parts: GlowPart[];
  whole: string;
}
const glows = new WeakMap<Scene, GlowUris>();
export function glowUris(night: Scene): GlowUris {
  let out = glows.get(night);
  if (!out) glows.set(night, (out = { parts: glowParts(night).map(({ stage, scene }) => ({ stage, uri: uriOf(scene) })), whole: uriOf(glowScene(night)) }));
  return out;
}

/** One part's glow, coming up with its part (`t` absent: there already). */
function GlowLayer({ stage, uri, side, t, times }: GlowPart & { side: number; t: SharedValue<number>; times: GlowTimes }) {
  const { from, to } = times[stage];
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (t.get() - from) / (to - from))) }));
  return (
    <Animated.View testID={`stage-glow-${stage}`} style={[styles.fill, style]}>
      <Picture uri={uri} side={side} />
    </Animated.View>
  );
}

function Picture({ uri, side }: { uri: string; side: number }) {
  return <Image source={{ uri }} style={styles.fill} blurRadius={Math.max(4, side / 12)} contentFit="contain" cachePolicy="memory" accessible={false} />;
}

/**
 * The glow (`t` absent: at rest, the whole glow). While it moves, its parts sit under one dimmer, composited
 * as a group (Android needs asking), so where they overlap it reads as one glow, not two.
 */
export function Glow({ glow, side, t, times }: { glow: GlowUris; side: number; t?: SharedValue<number>; times: GlowTimes }) {
  return (
    <View testID="stage-glow" style={[styles.fill, styles.glow]} needsOffscreenAlphaCompositing>
      {t ? glow.parts.map((part) => <GlowLayer key={part.stage} {...part} side={side} t={t} times={times} />) : <Picture uri={glow.whole} side={side} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  glow: { opacity: 0.5 },
});
