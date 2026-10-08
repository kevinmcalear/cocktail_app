/**
 * Smart defaults for the add-drink wizard, so a spec takes fewer taps: the
 * amount a new line starts at, what an amount typed as a fraction means, and
 * how the drink is probably served. All guesses from the house taste rules
 * (supabase/functions/_shared/flavor.ts) and sketch rules, never facts: every
 * one shows on screen and can be changed.
 */
import { ruleFor } from '../supabase/functions/_shared/flavor';

import { draftSketchInputs } from './sketch/draft';

export interface AmountLine {
  name: string;
  genericName?: string | null;
}

type Kind = 'spirit' | 'modifier' | 'liqueur' | 'rinse' | 'sour' | 'juice' | 'syrup' | 'creamy' | null;

function kindOf(l: AmountLine): Kind {
  const rule = ruleFor({ name: l.name, genericName: l.genericName ?? null });
  if (!rule) return null;
  const t = rule.taste;
  const sweet = t.sweet ?? 0;
  // Absinthe, fernet: a rinse or a bar spoon, not a pour.
  if (rule.abv >= 0.3 && (rule.x ?? 1) >= 2) return 'rinse';
  if (rule.abv >= 0.3) return sweet >= 0.4 ? 'liqueur' : 'spirit';
  if (rule.abv >= 0.1) return sweet >= 0.6 ? 'liqueur' : 'modifier';
  if ((t.sour ?? 0) >= 0.7) return 'sour';
  if ((t.creamy ?? 0) >= 0.8) return 'creamy';
  if (sweet >= 0.6) return 'syrup';
  if ((t.fruity ?? 0) >= 0.6) return 'juice';
  return null;
}

// What a bartender would reach for first, in ml.
function guessMl(line: AmountLine, others: readonly AmountLine[]): number | null {
  const kinds = others.map(kindOf);
  const sour = kinds.includes('sour');
  switch (kindOf(line)) {
    case 'spirit':
      // The first spirit is the base; another one splits it.
      return kinds.includes('spirit') ? 30 : 60;
    case 'modifier':
      return 30;
    case 'liqueur':
      return kinds.includes('syrup') || kinds.includes('liqueur') ? 15 : 22.5;
    case 'rinse':
      return 7.5;
    case 'sour':
      return 22.5;
    case 'syrup':
      // Rich syrup is sweeter, so less of it.
      return sour ? (/rich|2:1|demerara/i.test(line.name) ? 15 : 22.5) : 7.5;
    case 'juice':
    case 'creamy':
      return 30;
    default:
      return null;
  }
}

const OZ = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const nearest = (n: number, ladder: readonly number[]) => ladder.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
const fmt = (n: number) => String(Math.round(n * 100) / 100);

/**
 * The amount a new line starts at, in its unit: "22.5" ml of lime, "0.75" oz,
 * "2" dashes of bitters, "1" egg white. Empty when there's no good guess (a
 * top, a typed-in name the rules don't know), so the line reads unmeasured.
 */
export function suggestAmount(line: AmountLine, unit: string, others: readonly AmountLine[] = []): string {
  if (unit === 'top' || unit === 'g') return '';
  if (unit === 'dash' || unit === 'drop') return '2';
  if (unit === 'each') return '1';
  const ml = guessMl(line, others);
  if (ml === null) return '';
  if (unit === 'ml') return fmt(ml);
  if (unit === 'cl') return fmt(ml / 10);
  if (unit === 'oz') return fmt(nearest(ml / 30, OZ));
  if (unit === 'bsp') return fmt(Math.max(1, Math.round(ml / 5)));
  return '';
}

const FRACTIONS: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

/**
 * An amount as typed, tidied to a plain number: "3/4" is "0.75", "1 1/2" and
 * "1½" are "1.5", "22,5" is "22.5". Anything else is left as it was typed.
 */
export function tidyAmount(text: string): string {
  const t = text.trim().replace(',', '.');
  if (!t) return '';
  const m = /^(\d+(?:\.\d+)?)?\s*(?:(\d+)\s*\/\s*(\d+)|([¼½¾⅓⅔⅛]))?$/.exec(t);
  if (!m || (!m[1] && !m[2] && !m[4])) return text.trim();
  let n = m[1] ? parseFloat(m[1]) : 0;
  if (m[2] && m[3] && +m[3] > 0) n += +m[2] / +m[3];
  if (m[4]) n += FRACTIONS[m[4]];
  return fmt(n);
}

// The sketch rules' names for each choice, as the wizard's chips call them.
const METHOD_NAMES: Record<string, string> = { shake: 'Shake', stir: 'Stir', build: 'Build', blend: 'Blend', swizzle: 'Swizzle', throw: 'Throw', pour: 'Build' };
const GLASS_NAMES: Record<string, string> = {
  coupe: 'Coupe', nick: 'Nick & Nora', martini: 'Martini', rocks: 'Rocks', highball: 'Highball', collins: 'Collins', fizz: 'Highball',
  flute: 'Flute', wine: 'Wine', spritz: 'Wine', julep: 'Julep cup', tiki: 'Tiki', mug: 'Mug', ceramic: 'Tiki', beer: 'Highball', snifter: 'Rocks',
};
const ICE_NAMES: Record<string, string> = { none: 'No ice', cubes: 'Cubes', large: 'Large cube', spear: 'Spear', crushed: 'Crushed', pebble: 'Pebble', shaved: 'Crushed', sphere: 'Sphere' };

export interface ServeGuess {
  /** Each null when it's already picked, or there's nothing to go on. */
  method: string | null;
  glass: string | null;
  ice: string | null;
  /** Why, in a few words: "It has citrus". */
  why: string | null;
}

/**
 * How a drink is probably made and served, from its spec and name, by the
 * same rules that draw its sketch: citrus or egg is shaken, all spirit is
 * stirred, a topped drink is built. Only what isn't picked yet is guessed.
 */
export function serveGuess(look: Parameters<typeof draftSketchInputs>[0]): ServeGuess {
  if (!look.lines.length) return { method: null, glass: null, ice: null, why: null };
  const inputs = draftSketchInputs(look);
  const guessed = (k: 'method' | 'glass' | 'ice') => inputs.from[k] === 'rules';
  const method = guessed('method') ? METHOD_NAMES[inputs.method] ?? null : null;
  // The reason is the spec's only when the spec alone guesses the same: a name ("House Negroni") can say stir over citrus.
  const fromSpec = draftSketchInputs({ ...look, name: '', description: null }).method === inputs.method;
  const why = !fromSpec
    ? null
    : inputs.method === 'shake'
      ? 'It has citrus or egg, so it’s shaken'
      : inputs.method === 'build'
        ? 'It’s topped, so it’s built in the glass'
        : inputs.method === 'stir'
          ? 'It’s all spirit, so it’s stirred'
          : null;
  return {
    method,
    glass: guessed('glass') ? GLASS_NAMES[inputs.glass] ?? null : null,
    ice: guessed('ice') ? ICE_NAMES[inputs.ice] ?? null : null,
    why: method ? why : null,
  };
}
