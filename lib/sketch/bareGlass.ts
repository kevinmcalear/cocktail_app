import { itemGlass } from '../../supabase/functions/_shared/sketchKinds';

import { readSketchInputs, type SketchInputs } from './types';

// A literal, not bareGlassSketch('Coupe') run through the flavour rules (lib/sketch/draft), which would carry them into every page's first load. lib/sketch/draft.check.ts keeps them equal.
export const BARE_GLASS = readSketchInputs(JSON.parse('{"v":2,"glass":"coupe","ice":"none","method":"stir","liquid":{"hex":"#d8a050","alpha":0.05},"foam":null,"float":null,"bleed":null,"fizz":false,"garnish":null,"from":{"glass":"data","ice":"rules","method":"default","liquid":"default","garnish":"default"},"coverage":0,"variant":null}')) as SketchInputs;

/**
 * A bare glass, by its name or icon key ("Martini"): what a drink with no
 * drawing yet shows, in place of a line icon. What the flavour rules answer
 * for a drink with no spec (draftSketchInputs), worked out from the glass name
 * alone so DrinkImage doesn't load the rules; lib/sketch/draft.check.ts keeps
 * the two equal.
 */
export function bareGlassSketch(glass: string | null | undefined): SketchInputs {
  const kind = itemGlass(glass || 'Coupe');
  return { ...BARE_GLASS, glass: kind ?? 'rocks', liquid: { hex: BARE_GLASS.liquid.hex, alpha: 0 }, from: { ...BARE_GLASS.from, glass: kind ? 'data' : 'default' } };
}

/** A drink with nothing in it yet, as the flavour rules draw one (draftSketchInputs({ name: '', lines: [] })): what the glass and ice thumbnails draw over. draft.check.ts keeps them equal. */
export const EMPTY_DRINK: SketchInputs = {
  v: 2, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: BARE_GLASS.liquid.hex, alpha: 0.7 }, foam: null, float: null, bleed: null, fizz: false, garnish: null,
  from: { glass: 'default', ice: 'rules', method: 'default', liquid: 'default', garnish: 'default' }, coverage: 0, variant: null,
};
