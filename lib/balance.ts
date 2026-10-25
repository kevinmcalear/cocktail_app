/**
 * What a drink being built is missing, from the same taste rules the flavor
 * profiles use (supabase/functions/_shared/flavor.ts). A hint, never a rule:
 * bartenders break balance on purpose.
 */
import { profileFromSpec, type Profile, type SpecPart, type TasteDimension } from '../supabase/functions/_shared/flavor';

export interface BalanceLine {
  name: string;
  genericName?: string | null;
  amount: number | null;
  unit: string | null;
}

export interface Balance {
  strong: number;
  sour: number;
  sweet: number;
  bitter: number;
  /** One plain sentence, or null when there's nothing worth saying. */
  hint: string | null;
  /** What guests would taste, in words: "Dry, bright and bitter. Spirit-forward." (tasteSentence). */
  words: string;
  /** What would round it out, for one-tap fixes (fixesFor). */
  need: Need | null;
}

export type Need = 'sweet' | 'sour' | 'body';

/** Below this share of the spec understood, the meters would mislead: say nothing. */
const MIN_COVERAGE = 0.5;

const LOW = 0.1;

export function balanceOf(lines: readonly BalanceLine[]): Balance | null {
  if (!lines.length) return null;
  const parts: SpecPart[] = lines.map((l) => ({ id: null, name: l.name, genericName: l.genericName ?? null, amount: l.amount, unit: l.unit }));
  const { profile, coverage } = profileFromSpec(parts);
  if (coverage < MIN_COVERAGE) return null;
  const { strong, sour, sweet, bitter } = profile;
  let hint: string | null = null;
  let need: Need | null = null;
  if (sour > 0.25 && sweet < LOW) {
    hint = 'Sour with nothing sweet. Most drinks like this add a syrup or a liqueur.';
    need = 'sweet';
  } else if (sweet > 0.35 && sour < LOW && bitter < LOW) {
    hint = 'Sweet with nothing to balance it. A little citrus or bitters would.';
    need = 'sour';
  } else if (strong > 0.85 && sour < LOW && bitter < LOW) {
    // Neat spirit already reads a little sweet (whiskey), so strength alone says "all spirit".
    hint = 'All spirit so far. Stirred drinks usually add a vermouth, or a little sugar and bitters.';
    need = 'body';
  }
  return { strong, sour, sweet, bitter, hint, need, words: tasteSentence(profile) };
}

// How each taste reads in a sentence about the drink (sour reads as bright, as bartenders say it).
const TASTE_ADJECTIVE: Record<TasteDimension, string> = {
  sweet: 'sweet',
  sour: 'bright',
  bitter: 'bitter',
  botanical: 'juniper-led',
  herbal: 'herbal',
  fruity: 'fruity',
  spiced: 'spiced',
  spicy: 'hot',
  smoky: 'smoky',
  savory: 'savory',
  creamy: 'creamy',
};
const NOTABLE = 0.3;

/**
 * The desktop taste card's line (make-create-desktop, m07): up to three tastes
 * that stand out, "dry" first when there's next to no sugar, then how strong
 * it is. "Dry, bright and bitter. Spirit-forward."
 */
export function tasteSentence(profile: Profile): string {
  const top = (Object.keys(TASTE_ADJECTIVE) as TasteDimension[])
    .filter((d) => profile[d] >= NOTABLE && !(d === 'sweet' && profile.sweet < LOW))
    .sort((a, b) => profile[b] - profile[a])
    .map((d) => TASTE_ADJECTIVE[d]);
  const words = [...(profile.sweet < LOW ? ['dry'] : []), ...top].slice(0, 3);
  const strength = profile.strong < 0.35 ? 'Light on alcohol.' : profile.strong < 0.7 ? 'Medium strength.' : 'Spirit-forward.';
  if (!words.length) return strength;
  const said = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  return `${said.charAt(0).toUpperCase()}${said.slice(1)}. ${strength}`;
}

/** A taste meter's value as the desktop page says it: strength is light to strong, the rest none to a lot. */
export function tasteWord(dimension: 'strong' | 'sour' | 'sweet' | 'bitter', value: number): string {
  if (dimension === 'strong') return value < 0.35 ? 'light' : value < 0.7 ? 'medium' : 'strong';
  if (value < 0.05) return 'none';
  if (value < 0.2) return 'a touch';
  if (value < 0.4) return 'a little';
  return value < 0.65 ? 'some' : 'a lot';
}

// The base spirit decides which sugar, citrus or vermouth is the natural fit.
const BASES: readonly [RegExp, Record<Need, readonly string[]>][] = [
  [/tequila|mezcal|raicilla|sotol|agave/, { sweet: ['Agave syrup', 'Orange liqueur'], sour: ['Lime juice', 'Angostura bitters'], body: ['Agave syrup', 'Orange bitters'] }],
  [/rum|cacha[cç]a|rhum|arrack/, { sweet: ['Simple syrup', 'Demerara syrup'], sour: ['Lime juice', 'Angostura bitters'], body: ['Demerara syrup', 'Angostura bitters'] }],
  [/whisk|bourbon|rye|scotch|brandy|cognac|armagnac|calvados/, { sweet: ['Simple syrup', 'Honey syrup'], sour: ['Lemon juice', 'Angostura bitters'], body: ['Sweet vermouth', 'Angostura bitters'] }],
  [/gin|vodka|genever|aquavit|pisco|shochu|baijiu/, { sweet: ['Simple syrup', 'Orange liqueur'], sour: ['Lemon juice', 'Lime juice'], body: ['Dry vermouth', 'Orange bitters'] }],
];
const ANY: Record<Need, readonly string[]> = { sweet: ['Simple syrup'], sour: ['Lemon juice', 'Angostura bitters'], body: ['Sweet vermouth', 'Angostura bitters'] };

/** The one-tap fixes for what a drink needs, by its base: "Agave syrup" for a sour mezcal drink. Leaves out what's already in it. */
export function fixesFor(need: Need, lines: readonly Pick<BalanceLine, 'name' | 'genericName'>[]): string[] {
  const text = lines.map((l) => `${l.name} ${l.genericName ?? ''}`.toLowerCase()).join(' | ');
  const names = BASES.find(([re]) => re.test(text))?.[1][need] ?? ANY[need];
  return names.filter((n) => !text.includes(n.toLowerCase()));
}
