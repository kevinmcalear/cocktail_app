import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AnimatedSketch } from '@/components/ds/AnimatedSketch';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { COUNTED_STEPS, sketchLook, WIZARD_STEPS, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';
import { draftSketchInputs, type DraftLook } from '@/lib/sketch/draft';
import type { SketchInputs } from '@/lib/sketch/types';

import { PaperBand } from './PaperBand';

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
  /** The bar's glasses' drawings (bar_glassware), drawn when no shape is picked. */
  barVariants?: readonly string[];
  /** The drawing's side; by default 200 in a column and 152 in a phone's band. */
  size?: number;
}

/**
 * The add-drink wizard's paper band, with the drink drawn as it's being
 * added. Every step redraws it (glass, ice, method, colour, garnish) with the
 * rules the saved drink is drawn with.
 */
export function SketchHeader({ draft, step, barVariants, ...band }: SketchHeaderProps) {
  const inputs = inputsFor(sketchLook(draft, barVariants));
  const at = WIZARD_STEPS.indexOf(step);
  const counted = Math.min(at + 1, COUNTED_STEPS);
  // The review step draws the finished drink again from a blank page; a tap replays it.
  const reviewing = step === 'review';
  const [play, setPlay] = useState(0);
  // The draft's id once it has one: the saved drink is drawn with its id, so it keeps this drawing.
  const seed = draft.id ?? SEED;
  return (
    <PaperBand
      {...band}
      first={at === 0}
      progress={{ now: counted, of: COUNTED_STEPS, label: step === 'review' ? 'Review' : `${counted} of ${COUNTED_STEPS}` }}
      art={
        reviewing ? (
          // A toy, not a control: the band's label already names the drawing.
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPlay((n) => n + 1)} accessible={false}>
            <AnimatedSketch inputs={inputs} seed={seed} play={play} />
          </Pressable>
        ) : (
          <SketchDrawing inputs={inputs} seed={seed} detail="full" />
        )
      }
      artKey={`${reviewing ? 'review:' : ''}${JSON.stringify(inputs)}`}
      note={reviewing ? 'Tap to draw it again' : 'Updates as you go'}
      artLabel="Sketch of the drink so far"
    />
  );
}
