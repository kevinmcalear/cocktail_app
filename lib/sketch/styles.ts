// The house hands for drawn sketches. Graphite and wash is the default.
// Distances are in scene units (a 512 square), like the browser prototype.

import { SKETCH } from '@/constants/sketch';

export interface SketchStyle {
  ink: string;
  /** Broken-line patterns that stand in for the pencil's grain; one is picked per stroke. */
  dashes: string[];
  passes: number;
  width: number;
  alpha: number;
  wobble: number;
  drift: number;
  over: number;
  gaps: number;
  smudge: boolean;
  layers: number;
  wash: number;
  misreg: number;
  spill: number;
  fadeTo: number;
  blooms: number;
  hatch: number;
  cross: boolean;
  construct: number;
  ghosts: number;
  ghostA: number;
  shadow: number;
  splatter: number;
  mute: number;
}

export const SKETCH_STYLES = {
  graphite: {
    ink: SKETCH.graphite, dashes: ['7 1.1 3 0.7', '11 0.9 4 1.2 2 0.6', '5 0.8 9 1'], passes: 3, width: 0.88, alpha: 0.8,
    wobble: 1.3, drift: 0.9, over: 12, gaps: 0.35, smudge: false, layers: 38, wash: 0.05, misreg: 4, spill: 0.02,
    fadeTo: 0.5, blooms: 2, hatch: 0.4, cross: false, construct: 0.16, ghosts: 4, ghostA: 1.6, shadow: 0.6, splatter: 0, mute: 0.22,
  },
  charcoal: {
    ink: SKETCH.charcoal, dashes: ['4 1.6 2 1.2', '6 2 3 1.4'], passes: 4, width: 2.6, alpha: 0.75,
    wobble: 2.1, drift: 1.4, over: 18, gaps: 0.45, smudge: true, layers: 42, wash: 0.06, misreg: 7, spill: 0.05,
    fadeTo: 0.28, blooms: 3, hatch: 1, cross: true, construct: 0.2, ghosts: 2, ghostA: 1, shadow: 1.1, splatter: 0, mute: 0.05,
  },
  ink: {
    ink: SKETCH.sepia, dashes: [], passes: 2, width: 1.45, alpha: 0.85,
    wobble: 2.4, drift: 0.45, over: 5, gaps: 0.3, smudge: false, layers: 46, wash: 0.055, misreg: 6, spill: 0.09,
    fadeTo: 0.4, blooms: 4, hatch: 0.3, cross: false, construct: 0, ghosts: 1, ghostA: 1, shadow: 0.45, splatter: 4, mute: 0.08,
  },
} satisfies Record<string, SketchStyle>;

export type SketchStyleKey = keyof typeof SKETCH_STYLES;
export const DEFAULT_SKETCH_STYLE: SketchStyleKey = 'graphite';

/** Paper and the colours drawn on it. Paper stays paper in both themes (see constants/tokens.ts paper). */
export const SKETCH_PAPER = SKETCH.paper;
export const LIFT = SKETCH.lift;
export const SMUDGE = SKETCH.smudge;
export const CRUMB = SKETCH.crumb;
