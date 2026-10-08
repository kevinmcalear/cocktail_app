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
  return (
    <PaperBand
      {...band}
      first={at === 0}
      progress={{ now: counted, of: COUNTED_STEPS, label: step === 'review' ? 'Review' : `${counted} of ${COUNTED_STEPS}` }}
      // The draft's id once it has one: the saved drink is drawn with its id, so it keeps this drawing.
      art={<SketchDrawing inputs={inputs} seed={draft.id ?? SEED} detail="full" />}
      artKey={JSON.stringify(inputs)}
      artLabel="Sketch of the drink so far"
    />
  );
}
