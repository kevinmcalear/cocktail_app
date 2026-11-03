import { draftSketchInputs, type DraftLook } from '@/lib/sketch/draft';
import type { SketchInputs } from '@/lib/sketch/types';

let last: { key: string; inputs: SketchInputs } | null = null;

/** A draft's sketch inputs, worked out again only when its look changes (the desktop rail redraws on every keystroke). */
export function inputsFor(look: DraftLook): SketchInputs {
  const key = JSON.stringify(look);
  if (last?.key !== key) last = { key, inputs: draftSketchInputs(look) };
  return last.inputs;
}
