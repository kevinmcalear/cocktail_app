import type { GlassOutline } from './outline';
import type { SketchInputs } from './types';

/** What a bar's glass needs to say for a drawing: its type, its drawing, its traced shape, and whether it's the default of its type. */
export interface DrawingGlass {
  glass: string;
  variant: string | null;
  is_default: boolean;
  outline: GlassOutline | null;
  model?: { outline?: GlassOutline | null } | null;
}

/**
 * A drink drawn in the bar's own glassware (decision drawing-sizes: "three
 * sizes, in each bar's own glassware"). The database already draws a bar's own
 * drinks in its glasses (item_sketches.inputs variant and outline,
 * 20261113100000_glass_outlines.sql). A drink from elsewhere, a classic on the
 * bar's menu, comes with neither, so it takes the bar's default glass of its
 * type here, by the database's rule (item_sketch_variant: the glass's variant;
 * item_sketch_outline: its own traced outline, else its model's). A drink that
 * names a drawing or a real glass (its model gives glassMm) keeps it.
 */
export function inBarGlass(inputs: SketchInputs, glasses: readonly DrawingGlass[] | null | undefined): SketchInputs {
  if (!glasses?.length || inputs.variant || inputs.outline || inputs.glassMm) return inputs;
  const own = glasses.find((g) => g.glass === inputs.glass && g.is_default);
  if (!own) return inputs;
  const variant = own.variant && own.variant.startsWith(`${inputs.glass}_`) ? own.variant : null;
  const outline = own.outline ?? own.model?.outline ?? null;
  if (!variant && !outline) return inputs;
  return { ...inputs, variant, ...(outline ? { outline } : {}) };
}

// The same drink and the same bar give back the same object, so the painted
// scene (cached per inputs object) is painted once.
const memo = new WeakMap<SketchInputs, WeakMap<readonly DrawingGlass[], SketchInputs>>();
export function inBarGlassCached(inputs: SketchInputs, glasses: readonly DrawingGlass[] | null | undefined): SketchInputs {
  if (!glasses?.length) return inputs;
  let byBar = memo.get(inputs);
  if (!byBar) memo.set(inputs, (byBar = new WeakMap()));
  let out = byBar.get(glasses);
  if (!out) byBar.set(glasses, (out = inBarGlass(inputs, glasses)));
  return out;
}
