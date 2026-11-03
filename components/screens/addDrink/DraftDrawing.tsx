import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { PencilDrawing } from '@/components/ds';
// The web loads it (and its Reanimated) when the draft first draws, not with every page.
import { AnimatedSketch } from '@/components/ds/AnimatedSketchLazy';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SketchInputs } from '@/lib/sketch/types';

/**
 * The draft's pencil drawing, drawn in front of you when the page opens and
 * again on a tap (the wizard's review step did this, #349): the pencil finds
 * the glass rim first, the ice drops, the garnish lands. An edit (a new glass,
 * ice or garnish) shows the still drawing at once rather than starting over;
 * a tap draws the new one. Reduce Motion: the still drawing.
 */
export function DraftDrawing({ inputs, seed, size }: { inputs: SketchInputs; seed: string; size: number }) {
  const look = JSON.stringify(inputs);
  // The look being drawn and which time: a tap draws the drawing as it is now.
  const [staged, setStaged] = useState({ look, play: 0 });
  const still = useReducedMotion() || staged.look !== look;
  return (
    // A toy, not a control: the drawing is decorative here (the rows below say what it shows).
    <Pressable testID="draft-drawing" onPress={() => setStaged((s) => ({ look, play: s.play + 1 }))} accessible={false} aria-hidden>
      {still ? (
        <PencilDrawing inputs={inputs} seed={seed} size={size} />
      ) : (
        <View style={{ width: size, height: size }}>
          <AnimatedSketch inputs={inputs} seed={seed} play={staged.play} pencil />
        </View>
      )}
    </Pressable>
  );
}
