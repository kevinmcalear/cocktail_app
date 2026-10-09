/**
 * The technique library's shapes. The data is in this folder, written in our
 * own words from the sources each entry cites (facts and ratios, never their
 * prose). Every number carries a grade:
 *   A  a primary or tested source (the author's own measured method, a maker's
 *      data sheet, a university extension page)
 *   B  one bar or vendor source, or good sources that disagree a little
 *   C  a forum post, or our own arithmetic nobody has tested: show it as a
 *      starting point to test, never as the answer
 */

export type Grade = 'A' | 'B' | 'C';

export interface Source {
  name: string;
  url: string;
  grade: Grade;
}

export type TechniqueGroup = 'foam' | 'clarify' | 'wash' | 'infuse' | 'syrup' | 'texture' | 'carbonate' | 'cold' | 'preserve' | 'distil';

/** Something added per unit of the base: 0.25 ml milk per ml of batch. */
export interface Part {
  name: string;
  per: number;
  unit: 'g' | 'ml' | 'drops';
}

export interface Step {
  text: string;
  /** A timer to run on this step, in seconds. */
  timer?: number;
}

export interface Technique {
  id: string;
  name: string;
  group: TechniqueGroup;
  /** Other names people search by ("milk punch"). */
  also?: string[];
  /** One line: what it does. */
  summary: string;
  /** How it works, in a sentence or two. */
  why: string;
  /** "30 min", "Overnight". */
  time: string;
  /** Start to finish, for the "under an hour" filter. */
  totalMinutes: number;
  keeps?: string;
  /** What the scaler scales from, with quick amounts to pick. */
  base?: { name: string; unit: 'g' | 'ml'; amounts: number[] };
  parts?: Part[];
  steps: Step[];
  /** Equipment ids it can't be done without (lib/techniques/equipment.ts). */
  equipment: string[];
  /** Equipment that helps but isn't needed. */
  helpful?: string[];
  vegan: boolean;
  allergens?: string[];
  /** Safety and the ways it goes wrong. */
  watch?: string[];
  /** A swap for vegans, or for a missing tool. */
  swap?: string;
  /** What nobody has measured yet. */
  unknown?: string;
  /** Shown before the steps: real injury risk, or the law. */
  gate?: 'safety' | 'legal';
  grade: Grade;
  sources: Source[];
}

export type EquipmentKind = 'measure' | 'mix' | 'pressure' | 'temperature' | 'separate' | 'specialist';

export interface Equipment {
  id: string;
  name: string;
  kind: EquipmentKind;
  /** What it's for, one line. */
  what: string;
  /** $ under about $50, $$ up to about $500, $$$ more. Only `price` is sourced. */
  tier: '$' | '$$' | '$$$';
  price?: string;
  /** What to use when you don't have one. */
  swap?: string;
  /** The spec or safety point that matters. */
  note?: string;
}
