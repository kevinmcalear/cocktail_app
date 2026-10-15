import { backbar, familyHues } from '@/constants/tokens';
import type { SketchInputs } from '@/lib/sketch/types';

const FROM: SketchInputs['from'] = { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' };
/** A stirred drink's drawing inputs, for bundled samples drawn without asking the server. */
export const sampleSketch = (glass: SketchInputs['glass'], ice: SketchInputs['ice'], hex: string, garnish: SketchInputs['garnish']): SketchInputs => ({
  v: 1,
  glass,
  ice,
  method: 'stir',
  liquid: { hex: hex.toLowerCase(), alpha: 0.9 },
  foam: null,
  float: null,
  bleed: null,
  fizz: false,
  garnish,
  from: FROM,
  coverage: 1,
  variant: null,
});

/**
 * The three drinks the brand preview shows (the ones the canvas draws), each
 * with the drawing inputs it would have (its liquid in a family hue), so the preview draws them like any
 * photo-less drink without asking the server.
 */
export const BRAND_SAMPLE = [
  { name: 'House Martini', line: 'Gin · dry vermouth', price: '18', isNew: false, sketch: sampleSketch('martini', 'none', backbar.dark.ink, 'lemon_peel') },
  { name: 'Bolo Tie', line: 'Rye · amaro · orange', price: '19', isNew: true, sketch: sampleSketch('rocks', 'large', familyHues.dark.oldfashioned, 'orange_peel') },
  { name: 'Champ Stamp', line: 'Bourbon · strawberry · smoke', price: '20', isNew: false, sketch: sampleSketch('rocks', 'cubes', familyHues.dark.negroni, 'strawberry') },
];
