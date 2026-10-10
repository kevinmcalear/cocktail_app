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

/**
 * What a technique starts from, the thing it changes: a spirit to wash or
 * infuse, a juice to clarify, produce to pickle. 'none' starts from nothing
 * on the shelf (a foam stock, ice).
 */
export type BaseKind = 'spirit' | 'wine' | 'juice' | 'produce' | 'liquid' | 'water' | 'sugar' | 'fat' | 'none';

/** The "with what" a maker swaps in: the fat in a fat wash, the herb in an oil. */
export type SlotRole = 'fat' | 'milk' | 'flavour' | 'botanical' | 'herb' | 'wood' | 'clarifier' | 'spirit';

/** Where a prep is kept. */
export type Storage = 'fridge' | 'freezer' | 'ambient' | 'airtight';

/** Something added per unit of the base: 0.25 ml milk per ml of batch. */
export interface Part {
  name: string;
  per: number;
  unit: 'g' | 'ml' | 'drops' | 'tsp';
  /** The "with what" a maker replaces (the fat, the milk, the solids). */
  slot?: SlotRole;
  /** A stand-in name ("Melted fat"), never saved: it must be filled first. */
  generic?: boolean;
  /** Lifted off or strained out (the fat cap, milk curds, solids): not in the yield. */
  removed?: boolean;
}

/**
 * A different keep (or parts) when the "with what" or the name says so:
 * dairy and nut fat washes keep less, flavoured kombucha far less, rich
 * syrup more. When several match, the shortest keep wins.
 */
export interface Variant {
  /** Matched against the "with what" (or the prep's name, with on: 'name'), lower case. */
  words: RegExp;
  on?: 'name';
  keepsHours?: number;
  parts?: Part[];
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
  /**
   * Make in house: how long it keeps, in hours (minutes are fractions:
   * 5 / 60), always the safer number when sources differ; null with
   * `keepsWhy` when nothing sourced says.
   */
  keepsHours?: number | null;
  variants?: Variant[];
  storage?: Storage | null;
  /** Why there's no keep: required when keepsHours is null. */
  keepsWhy?: string;
  /** What it changes. Methods (a dry shake, clear ice) have none: they're never made in house. */
  starts?: BaseKind;
  /** The "with what" slot, when there is one (the fat, the botanicals). */
  withWhat?: SlotRole;
  /** The word in a made thing's name: "fat-washed", "clarified", "oil". */
  word?: string;
  /** How a made thing is named: {with}, {base} filled in ("{with} fat-washed {base}"). */
  nameAs?: string;
  /** A way of making a drink, not an ingredient: never offered as Make in house. */
  method?: boolean;
  /** What the scaler scales from, with quick amounts to pick. `slot`: a stand-in to fill ("Spirit"). */
  base?: { name: string; unit: 'g' | 'ml'; amounts: number[]; slot?: boolean };
  parts?: Part[];
  /** Lines nobody gives an amount for (to taste); `removed` ones aren't in the yield. */
  extra?: { name: string; removed?: boolean }[];
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

export type EquipmentKind = 'bar' | 'measure' | 'mix' | 'pressure' | 'temperature' | 'separate' | 'specialist';

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
  /** Where to buy one: a maker or specialist shop page, best first. Not affiliate links. */
  buy?: BuyLink[];
}

export interface BuyLink {
  /** The product and the shop: "Thermapen ONE, ThermoWorks". */
  name: string;
  url: string;
  /** Home size or home-grade; bar is bulk or commercial. Left out, it suits both. */
  audience?: BuyAudience;
}

export type BuyAudience = 'home' | 'bar';
