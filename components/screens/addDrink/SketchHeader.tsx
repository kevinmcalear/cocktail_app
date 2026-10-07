import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { Caption, PressableScale, Tag, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, fontFamilies, layout, radius, space, springs } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { COUNTED_STEPS, sketchLook, WIZARD_STEPS, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';
import { draftSketchInputs, type DraftLook } from '@/lib/sketch/draft';
import type { SketchInputs } from '@/lib/sketch/types';

/** The seed only moves the pencil's wobble; a fixed one keeps the drawing steady while the drink changes. */
const SEED = 'new-drink';

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
}

/**
 * The paper band at the top: back, progress and the drink drawn as it's
 * being added. Every step redraws it (glass, ice, method, colour, garnish)
 * with the rules the saved drink is drawn with; a new drawing fades in over
 * the old one and gives a small pour bounce, so each choice lands.
 */
export function SketchHeader({ draft, step, onBack, top, side, rounded, folded }: SketchHeaderProps) {
  const ds = useDs();
  const ink = ds.c.sketchInk;
  const reduceMotion = useReducedMotion();
  const inputs = inputsFor(sketchLook(draft));
  const drawKey = JSON.stringify(inputs);
  const at = WIZARD_STEPS.indexOf(step);
  const counted = Math.min(at + 1, COUNTED_STEPS);

  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    scale.set(withSequence(withSpring(0.96, springs.snap), withSpring(1, springs.pour)));
  }, [drawKey, reduceMotion, scale]);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const size = rounded ? 200 : 152;

  return (
    <View style={[styles.band, { backgroundColor: ds.c.paper, paddingTop: top, paddingHorizontal: side }, rounded && styles.rounded]}>
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
            <Animated.View key={drawKey} entering={FadeIn.duration(260)} exiting={FadeOut.duration(260)} style={StyleSheet.absoluteFill}>
              <SketchDrawing inputs={inputs} seed={SEED} detail="full" />
            </Animated.View>
          </Animated.View>
          <View style={styles.foot}>
            <Tag label="Sketch" tone="sketch" />
            <Caption color={ink} style={styles.mono}>
              Updates as you go
            </Caption>
          </View>
        </>
      )}
    </View>
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
  foot: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
