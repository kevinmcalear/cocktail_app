/**
 * Foam from anything: four answers narrow the foaming agents to one to start
 * with, the others that also work, and the ones ruled out (with why).
 * Doses and rules are in lib/techniques/data/foam.ts's sources; the 20%
 * alcohol ceiling is our arithmetic from Modernist Pantry's "dilute spirit by
 * half" rule, not a tested limit.
 */
import type { Grade } from './types';

export type FoamKind = 'shaken' | 'siphon' | 'air';
export type Diet = 'none' | 'vegan' | 'no-egg' | 'no-soy';

export interface FoamQuestion {
  kind: FoamKind;
  /** Cream, butter, coconut, nut milk, yolk, chocolate or a butter-washed spirit. */
  fat: boolean;
  /** The liquid being foamed is over about 20% alcohol. */
  strong: boolean;
  diet: Diet;
}

export interface FoamAgent {
  id: string;
  name: string;
  kinds: FoamKind[];
  dose: string;
  how: string;
  vegan: boolean;
  egg?: boolean;
  soy?: boolean;
  dairy?: boolean;
  /** Still foams with fat in the base. */
  fatOk: boolean;
  /** Holds up in liquid over about 20% alcohol. */
  strongOk: boolean;
  /** The technique page that walks through it. */
  technique?: string;
  /** The ingredient's name, to add it to a spec. */
  ingredient: string;
  /** What one drink takes, for a shaken foam added to a spec. */
  perDrink?: { amount: string; unit: string };
  grade: Grade;
}

export const FOAM_AGENTS: FoamAgent[] = [
  { id: 'egg', name: 'Egg white', kinds: ['shaken'], dose: '1 white (30 ml) per drink. Pasteurised is safer.', how: 'Reverse dry shake', vegan: false, egg: true, fatOk: false, strongOk: true, technique: 'reverse-dry-shake', ingredient: 'Egg white', perDrink: { amount: '30', unit: 'ml' }, grade: 'A' },
  { id: 'aquafaba', name: 'Aquafaba', kinds: ['shaken'], dose: '22 to 30 ml per drink', how: 'Reverse dry shake', vegan: true, fatOk: false, strongOk: true, technique: 'reverse-dry-shake', ingredient: 'Aquafaba', perDrink: { amount: '25', unit: 'ml' }, grade: 'B' },
  { id: 'quillaja', name: 'Foamer drops (quillaja)', kinds: ['shaken'], dose: '2 to 6 drops per drink, start with 3', how: 'Shake as usual', vegan: true, fatOk: true, strongOk: true, technique: 'reverse-dry-shake', ingredient: 'Cocktail foamer', perDrink: { amount: '3', unit: 'drop' }, grade: 'B' },
  { id: 'mc-syrup', name: 'Methylcellulose sour syrup', kinds: ['shaken'], dose: 'In place of the simple syrup', how: 'One hard shake, no dry shake', vegan: true, fatOk: false, strongOk: true, technique: 'sour-syrup', ingredient: 'Methylcellulose sour syrup', perDrink: { amount: '20', unit: 'ml' }, grade: 'B' },
  { id: 'gelatin', name: 'Gelatin', kinds: ['siphon'], dose: '0.75% with 0.1% xanthan', how: 'Siphon, chill an hour', vegan: false, fatOk: true, strongOk: false, technique: 'siphon-foam', ingredient: 'Gelatin', grade: 'B' },
  { id: 'mc-siphon', name: 'Methylcellulose and xanthan', kinds: ['siphon'], dose: '0.6% + 0.1% xanthan + 8% sugar', how: 'Siphon, cold', vegan: true, fatOk: false, strongOk: false, technique: 'vegan-siphon-foam', ingredient: 'Methylcellulose', grade: 'A' },
  { id: 'versawhip', name: 'Versawhip', kinds: ['siphon', 'shaken'], dose: '1% + 0.15% xanthan (a 4% stock for shaking)', how: 'Siphon or shake', vegan: true, soy: true, fatOk: false, strongOk: false, technique: 'siphon-foam', ingredient: 'Versawhip', grade: 'B' },
  { id: 'cream', name: 'Cream', kinds: ['siphon'], dose: '30 to 36% fat cream as the base', how: 'Siphon, or whip to soft peaks', vegan: false, dairy: true, fatOk: true, strongOk: true, ingredient: 'Heavy cream', grade: 'B' },
  { id: 'lecithin', name: 'Soy lecithin', kinds: ['air'], dose: '0.6%', how: 'Stick blender at the surface', vegan: true, soy: true, fatOk: false, strongOk: false, technique: 'lecithin-air', ingredient: 'Soy lecithin', grade: 'A' },
  { id: 'sucro', name: 'Sucrose esters', kinds: ['air', 'siphon'], dose: '0.5% (5 g per kg)', how: 'Stick blender', vegan: true, fatOk: true, strongOk: true, ingredient: 'Sucrose esters', grade: 'B' },
];

export interface FoamAnswer {
  /** Best first: agents that cope with strong liquid lead when it's strong. */
  works: FoamAgent[];
  ruledOut: { agent: FoamAgent; why: string }[];
  /** Said once, above the list. */
  note: string | null;
}

function whyNot(a: FoamAgent, q: FoamQuestion): string | null {
  if (q.fat && !a.fatOk) return 'Fat stops it foaming';
  if (q.diet === 'vegan' && !a.vegan) return 'Not vegan';
  if (q.diet === 'no-egg' && a.egg) return 'Egg';
  if (q.diet === 'no-soy' && a.soy) return 'Soy';
  return null;
}

export function pickFoam(q: FoamQuestion): FoamAnswer {
  const works: FoamAgent[] = [];
  const ruledOut: FoamAnswer['ruledOut'] = [];
  for (const a of FOAM_AGENTS.filter((x) => x.kinds.includes(q.kind))) {
    const why = whyNot(a, q);
    if (why) ruledOut.push({ agent: a, why });
    else works.push(a);
  }
  // A shaken drink is foamed whole, so strength only matters for a foam made on its own.
  const strongMatters = q.strong && q.kind !== 'shaken';
  if (strongMatters) works.sort((a, b) => Number(b.strongOk) - Number(a.strongOk));
  let note: string | null = null;
  if (strongMatters) note = 'Most foamers fade above about 20% alcohol (our estimate, not a tested limit). Foam the syrup or juice and pour it over, or dilute the spirit by half first.';
  else if (!works.length) note = 'Nothing here foams that combination. Try a siphon with cream, or leave the fat out of the foam.';
  return { works, ruledOut, note };
}

const FOAMER = /egg white|aquafaba|foamer|quillaja|versawhip|methylcellulose|sour syrup|foam/i;

/** A dry shake with nothing in the spec that foams: the method step offers a foamer. */
export function needsFoamer(methods: readonly string[], lines: readonly string[]): boolean {
  return methods.some((m) => /dry shake/i.test(m)) && !lines.some((l) => FOAMER.test(l));
}
