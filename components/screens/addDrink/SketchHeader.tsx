import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Caption, PressableScale, Tag, useDs } from '@/components/ds';
import { AnimatedSketch } from '@/components/ds/AnimatedSketch';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, fontFamilies, layout, radius, space, springs } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { COUNTED_STEPS, sketchLook, WIZARD_STEPS, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';
import { draftSketchInputs, type DraftLook } from '@/lib/sketch/draft';
import type { SketchInputs } from '@/lib/sketch/types';

/** The seed only moves the pencil's wobble; a fixed one keeps the drawing steady while the drink changes. */
const SEED = 'new-drink';
/** On review, how long the finished drawing takes to fade before it's drawn again. */
const FADE_FIRST_MS = 450;

// The last drawing's inputs, so a keystroke that doesn't change the drink
// hands SketchDrawing the same object (it caches the painted scene by it).
let last: { key: string; inputs: SketchInputs } | null = null;
function inputsFor(look: DraftLook): SketchInputs {
  const key = JSON.stringify(look);
  if (last?.key !== key) last = { key, inputs: draftSketchInputs(look) };
  return last.inputs;
}

interface SketchHeaderProps {
  draft: WizardDraft;
  step: WizardStep;
  onBack: () => void;
  /** Space above the controls (the status bar on a phone). */
  top: number;
  side: number;
  /** In a centred column (wide screens): rounded, not edge to edge. */
  rounded: boolean;
  /** Just the controls, while the keyboard is up on a phone. */
  folded?: boolean;
  /** The bar's glasses' drawings (bar_glassware), drawn when no shape is picked. */
  barVariants?: readonly string[];
  /** The drawing's side; by default 200 in a column and 152 in a phone's band. */
  size?: number;
}

/**
 * The paper band at the top: back, progress and the drink drawn as it's
 * being added. Every step redraws it (glass, ice, method, colour, garnish)
 * with the rules the saved drink is drawn with; a new drawing fades in over
 * the old one and gives a small pour bounce, so each choice lands.
 */
export function SketchHeader({ draft, step, onBack, top, side, rounded, folded, barVariants, size: sizeProp }: SketchHeaderProps) {
  const ds = useDs();
  const ink = ds.c.sketchInk;
  const reduceMotion = useReducedMotion();
  const inputs = inputsFor(sketchLook(draft, barVariants));
  const drawKey = JSON.stringify(inputs);
  // The drawing before this one, faded out under the new one. Plain opacity, not
  // Reanimated's exiting animations: an exiting view removed again mid-fade (each
  // keystroke redraws, the keyboard folds the band) corrupted its view bookkeeping
  // and crashed iOS release builds.
  const [shown, setShown] = useState<{ now: SketchInputs; before: SketchInputs | null; n: number }>({ now: inputs, before: null, n: 0 });
  if (shown.now !== inputs) setShown({ now: inputs, before: shown.now, n: shown.n + 1 });
  const at = WIZARD_STEPS.indexOf(step);
  const counted = Math.min(at + 1, COUNTED_STEPS);
  // The review step draws the finished drink again from a blank page; a tap replays it.
  const reviewing = step === 'review';
  const [play, setPlay] = useState(0);
  const seed = draft.id ?? SEED;

  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    scale.set(withSequence(withSpring(0.96, springs.snap), withSpring(1, springs.pour)));
  }, [drawKey, reduceMotion, scale]);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const size = sizeProp ?? (rounded ? 200 : 152);

  return (
    <View style={[styles.band, { backgroundColor: ds.c.paper, paddingTop: top, paddingHorizontal: side }, rounded && styles.rounded]}>
      {/* Android draws the band under the status bar: dark icons, so they read on paper in both themes. */}
      {Platform.OS === 'android' && !rounded ? <StatusBar style="dark" /> : null}
      <View style={styles.controls}>
        <PressableScale
          onPress={onBack}
          accessibilityLabel={at === 0 ? 'Close. Your draft is kept' : 'Back'}
          style={[styles.back, { backgroundColor: backbar.light.glass }]}
        >
          <IconSymbol name={at === 0 ? 'xmark' : 'chevron.left'} size={18} color={ink} />
        </PressableScale>
        <View
          style={[styles.track, { backgroundColor: withAlpha(ink, 0.15) }]}
          role="progressbar"
          accessibilityLabel="Progress"
          aria-valuemin={0}
          aria-valuemax={COUNTED_STEPS}
          aria-valuenow={counted}
        >
          <View style={[styles.fill, { backgroundColor: ink, width: `${(counted / COUNTED_STEPS) * 100}%` }]} />
        </View>
        <Caption color={ink} style={styles.mono}>
          {step === 'review' ? 'Review' : `${counted} of ${COUNTED_STEPS}`}
        </Caption>
      </View>
      {folded ? null : (
        <>
          <Animated.View style={[styles.drawing, { width: size, height: size }, bounce]} aria-label="Sketch of the drink so far">
            {/* The draft's id once it has one: the saved drink is drawn with its id, so it keeps this drawing. */}
            {reviewing ? (
              // A toy, not a control: the band's label already names the drawing.
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setPlay((n) => n + 1)} accessible={false}>
                <AnimatedSketch inputs={inputs} seed={seed} play={play} delay={FADE_FIRST_MS} />
                {/* The finished drawing fades away first, then the pencil starts on blank paper. */}
                <Layer key={`fade-${play}`} inputs={inputs} seed={seed} from={1} to={0} duration={FADE_FIRST_MS} />
              </Pressable>
            ) : (
              <>
                {shown.before ? <Layer key={`out-${shown.n - 1}`} inputs={shown.before} seed={seed} from={1} to={0} /> : null}
                <Layer key={`in-${shown.n}`} inputs={shown.now} seed={seed} from={0} to={1} />
              </>
            )}
          </Animated.View>
          <View style={styles.foot}>
            <Tag label="Sketch" tone="sketch" />
            <Caption color={ink} style={styles.mono}>
              {reviewing ? 'Tap to draw it again' : 'Updates as you go'}
            </Caption>
          </View>
        </>
      )}
    </View>
  );
}

/** One drawing, fading from `from` to `to` opacity once, when it mounts. */
function Layer({ inputs, seed, from, to, duration = 260 }: { inputs: SketchInputs; seed: string; from: number; to: number; duration?: number }) {
  const opacity = useSharedValue(from);
  useEffect(() => {
    opacity.set(withTiming(to, { duration }));
  }, [opacity, to, duration]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.passThrough, fade]}>
      <SketchDrawing inputs={inputs} seed={seed} detail="full" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: { paddingBottom: space.md, alignItems: 'center' },
  rounded: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  controls: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill },
  mono: { fontFamily: fontFamilies.monoMedium },
  drawing: { marginTop: space.sm },
  passThrough: { pointerEvents: 'none' },
  foot: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
