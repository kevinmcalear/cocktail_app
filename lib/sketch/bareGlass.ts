import { readSketchInputs, type SketchInputs } from './types';

// A literal, not bareGlassSketch('Coupe') (lib/sketch/draft), which would carry the flavour rules into every page's first load. lib/sketch/draft.check.ts keeps them equal.
export const BARE_GLASS = readSketchInputs(JSON.parse('{"v":2,"glass":"coupe","ice":"none","method":"stir","liquid":{"hex":"#d8a050","alpha":0.05},"foam":null,"float":null,"bleed":null,"fizz":false,"garnish":null,"from":{"glass":"data","ice":"rules","method":"default","liquid":"default","garnish":"default"},"coverage":0,"variant":null}')) as SketchInputs;
