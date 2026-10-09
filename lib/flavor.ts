/**
 * Your taste and how well a drink fits it (consumer discovery, "For you").
 *
 * Every drink with a spec gets a flavor profile on the server: twelve
 * dimensions, 0 to 1 (supabase/functions/_shared/flavor.ts has the rules).
 * Your taste is the same twelve dimensions: the average drink, pulled towards
 * the drinks you love and pushed away from the ones you don't (lib/palate.ts).
 * Your answers to a few questions (asked at setup, and changeable on /taste)
 * start it off and count for less with every drink you rank. Until you've
 * ranked enough drinks we don't show a match percentage.
 */

export const DIMENSIONS = [
  'sweet',
  'sour',
  'bitter',
  'strong',
  'botanical',
  'herbal',
  'fruity',
  'spiced',
  'spicy',
  'smoky',
  'savory',
  'creamy',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type Profile = Record<Dimension, number>;
/** A taste can be partial: quick answers only cover some dimensions. */
export type Taste = Partial<Record<Dimension, number>>;

// The words people see. Keys stay as stored; the shown word follows how
// drinkers talk: nobody says "botanical" or "spiced", and "spicy" reads as
// chili, ginger or rye (https://claude.ai/artifact/K3hyAh5Zr1eGAcaaunrWFj).
export const LABEL: Record<Dimension, string> = {
  sweet: 'sweet',
  sour: 'sour',
  bitter: 'bitter',
  strong: 'strong',
  botanical: 'juniper',
  herbal: 'herbal',
  fruity: 'fruity',
  spiced: 'warm spice',
  spicy: 'heat',
  smoky: 'smoky',
  savory: 'savory',
  creamy: 'creamy',
};

/**
 * Tasting notes Discover can filter by. Strong is left out: nearly every
 * cocktail reads strong, so the chip wouldn't narrow the list.
 */
export const NOTE_KINDS = DIMENSIONS.filter((d): d is Exclude<Dimension, 'strong'> => d !== 'strong');

/** A drink tastes of a note from here up. Same bar matchReasons uses. */
export const NOTE_MIN = 0.4;

export const noteKind = (d: Exclude<Dimension, 'strong'>) => `note:${d}`;

export function noteDimension(kind: string): Exclude<Dimension, 'strong'> | null {
  if (!kind.startsWith('note:')) return null;
  const d = kind.slice(5);
  return (NOTE_KINDS as readonly string[]).includes(d) ? (d as Exclude<Dimension, 'strong'>) : null;
}

export function noteWord(d: Exclude<Dimension, 'strong'>): string {
  const word = LABEL[d];
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function noteLabel(kind: string): string | null {
  const d = noteDimension(kind);
  return d ? noteWord(d) : null;
}

/** Profiles that understood less than this share of their spec aren't used. Mirrors the server's flavor functions. */
export const MIN_COVERAGE = 0.5;
/** Ranked drinks (with a profile) before your taste comes from rankings and matches show a percentage. */
export const COLD_START_DRINKS = 5;

/** Where a taste came from, which changes how we talk about it. */
export type TasteBasis = 'ranked' | 'answers';

// How fast the match falls with distance: an average gap of 0.2 per
// dimension is a 75% match, 0.4 is 50%.
const MATCH_FALLOFF = 1.25;

const dimsIn = (taste: Taste) => DIMENSIONS.filter((d) => typeof taste[d] === 'number');

/** Root-mean-square gap between two profiles over the dimensions the first one has. 0 = the same. */
export function distance(a: Taste, b: Taste): number {
  const dims = dimsIn(a).filter((d) => typeof b[d] === 'number');
  if (!dims.length) return 1;
  return Math.sqrt(dims.reduce((sum, d) => sum + (a[d]! - b[d]!) ** 2, 0) / dims.length);
}

/** How well a drink fits a taste, 0 to 100. Null when the taste says nothing yet. */
export function matchPercent(taste: Taste, profile: Profile): number | null {
  if (!dimsIn(taste).length) return null;
  return Math.round(100 * (1 - Math.min(1, distance(taste, profile) * MATCH_FALLOFF)));
}

const list = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0]);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The average profile of a set of drinks: what "usual" means for these drinks. */
export function meanProfile(profiles: readonly Profile[]): Profile | null {
  if (!profiles.length) return null;
  return Object.fromEntries(DIMENSIONS.map((d) => [d, profiles.reduce((sum, p) => sum + p[d], 0) / profiles.length])) as Profile;
}

/**
 * Why a drink fits (or doesn't), in words: the dimensions it shares with your
 * taste, then where it's well past (or well short of) what you usually go for.
 * "Bitter and strong, like the drinks you rank highest."
 * With a baseline (the average drink), shared dimensions count only where
 * both your taste and the drink are above average, most distinctive first,
 * so "strong", which nearly every cocktail is, doesn't lead every reason.
 */
export function matchReasons(taste: Taste, profile: Profile, basis: TasteBasis, baseline?: Profile | null): string {
  const dims = dimsIn(taste);
  const lift = (d: Dimension) => Math.min(taste[d]!, profile[d]) - (baseline?.[d] ?? 0);
  const shared = dims
    .filter((d) => taste[d]! >= 0.4 && profile[d] >= 0.4 && (!baseline || lift(d) > 0))
    .sort((a, b) => lift(b) - lift(a))
    .slice(0, 2);
  const over = dims
    .filter((d) => !shared.includes(d) && profile[d] - taste[d]! >= 0.3)
    .sort((a, b) => profile[b] - taste[b]! - (profile[a] - taste[a]!))
    .slice(0, 1);
  const under = dims
    .filter((d) => !shared.includes(d) && taste[d]! - profile[d] >= 0.3)
    .sort((a, b) => taste[b]! - profile[b] - (taste[a]! - profile[a]))
    .slice(0, 1);
  const like = basis === 'ranked' ? 'like the drinks you rank highest' : 'as you said you like';
  if (shared.length && over.length) return `${capital(list(shared.map((d) => LABEL[d])))}, ${like}, but more ${LABEL[over[0]]} than usual.`;
  if (shared.length) return `${capital(list(shared.map((d) => LABEL[d])))}, ${like}.`;
  if (over.length) return `More ${LABEL[over[0]]} than you usually go for.`;
  if (under.length) return `Less ${LABEL[under[0]]} than you usually go for.`;
  return 'Nothing far from what you usually enjoy.';
}

/** Your answers count as this many ranked drinks: half your taste at five, a fifth at twenty. */
export const ANSWER_WEIGHT = COLD_START_DRINKS;

/** How much of your taste comes from your answers, 0 to 1. */
export function answerShare(rankedDrinks: number): number {
  return ANSWER_WEIGHT / (ANSWER_WEIGHT + Math.max(0, rankedDrinks));
}

/**
 * Your taste: your answers blended with your rankings, the answers counting
 * for less with every drink you rank (answerShare) but never dropped, so
 * changing them always moves it. Basis 'answers' until there are enough
 * rankings for a match percentage.
 */
export function blendTaste(ranked: Taste | null, rankedDrinks: number, answers: Taste | null): { taste: Taste; basis: TasteBasis } {
  const said = answers && dimsIn(answers).length ? answers : null;
  const basis: TasteBasis = rankedDrinks >= COLD_START_DRINKS || !said ? 'ranked' : 'answers';
  if (!said) return { taste: ranked ?? {}, basis };
  const share = ranked && rankedDrinks > 0 ? answerShare(rankedDrinks) : 1;
  const taste: Taste = {};
  for (const d of DIMENSIONS) {
    const r = ranked?.[d];
    const a = said[d];
    if (typeof a === 'number' && typeof r === 'number' && share < 1) taste[d] = a * share + r * (1 - share);
    else if (typeof a === 'number') taste[d] = a;
    else if (typeof r === 'number' && share < 1) taste[d] = r;
  }
  return { taste, basis };
}

/** Where your taste comes from, in a sentence for the taste page. */
export function tasteSource(rankedDrinks: number, hasAnswers: boolean): string {
  const drinks = `${rankedDrinks} drink${rankedDrinks === 1 ? '' : 's'} you've ranked`;
  if (!rankedDrinks && !hasAnswers) return "Answer a few questions, or rank drinks you've had, and your taste shows here.";
  if (!rankedDrinks) return 'From your answers. Every drink you rank moves it.';
  if (!hasAnswers) return `From the ${drinks}, the ones you score highest counting most.`;
  const fromRanked = Math.round(100 * (1 - answerShare(rankedDrinks)));
  return `From your answers and the ${drinks}. Your rankings are ${fromRanked}% of it now, and count for more with every drink you rank.`;
}

/**
 * "Bitter, herbal and sweet": what stands out in a taste, or null when nothing
 * does yet. Strong is left out, as in NOTE_KINDS: nearly every cocktail is.
 */
export function tasteHeadline(taste: Taste): string | null {
  const top = dimsIn(taste)
    .filter((d) => d !== 'strong' && taste[d]! >= NOTE_MIN)
    .sort((a, b) => taste[b]! - taste[a]!)
    .slice(0, 3);
  return top.length ? capital(list(top.map((d) => LABEL[d]))) : null;
}

/**
 * Where your rankings have moved you away from what you said: "Your rankings
 * lean more smoky and less bitter than you said." Null until they differ by
 * a clear step, or without both.
 */
export function rankingsDrift(ranked: Taste | null, answers: Taste | null): string | null {
  if (!ranked || !answers) return null;
  const gap = (d: Dimension) => ranked[d]! - answers[d]!;
  const dims = dimsIn(answers).filter((d) => typeof ranked[d] === 'number' && Math.abs(gap(d)) >= 0.3);
  const more = dims.filter((d) => gap(d) > 0).sort((a, b) => gap(b) - gap(a)).slice(0, 2);
  const less = dims.filter((d) => gap(d) < 0).sort((a, b) => gap(a) - gap(b)).slice(0, 2);
  const parts = [more.length ? `more ${list(more.map((d) => LABEL[d]))}` : null, less.length ? `less ${list(less.map((d) => LABEL[d]))}` : null].filter(Boolean);
  return parts.length ? `Your rankings lean ${parts.join(' and ')} than you said.` : null;
}

/** A question about one dimension of your taste. Each answer sets it. */
export interface TasteQuestion {
  dim: Dimension;
  prompt: string;
}

/** One per dimension. Setup asks the first six (QUICK_QUESTIONS); the taste page asks them all. */
export const QUESTIONS: readonly TasteQuestion[] = [
  { dim: 'bitter', prompt: 'Bitter, like a Negroni?' },
  { dim: 'sour', prompt: 'Sour and bright, like a Daiquiri?' },
  { dim: 'sweet', prompt: 'Sweet?' },
  { dim: 'strong', prompt: 'Strong and stirred, like an Old Fashioned?' },
  { dim: 'smoky', prompt: 'Smoky, like mezcal?' },
  { dim: 'creamy', prompt: 'Creamy, like a Piña Colada?' },
  { dim: 'botanical', prompt: 'Juniper and pine, like a gin Martini?' },
  { dim: 'herbal', prompt: 'Herbal, like a Last Word or a Mojito?' },
  { dim: 'fruity', prompt: 'Fruity, like a Bramble?' },
  { dim: 'spiced', prompt: 'Warm spice, like cinnamon and clove in a Zombie?' },
  { dim: 'spicy', prompt: 'Heat, like a Spicy Margarita or a Moscow Mule?' },
  { dim: 'savory', prompt: 'Savory, like a Bloody Mary?' },
];

export const QUICK_QUESTIONS = QUESTIONS.slice(0, 6);

export const ANSWERS = [
  { label: 'Love it', value: 0.8 },
  { label: 'Sometimes', value: 0.45 },
  { label: 'Not for me', value: 0.1 },
] as const;

export interface FlavorDrink {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Shared (not a venue's) and not a version of another drink: a classic, as in Discover's lists. */
  isClassic: boolean;
  riffOfId: string | null;
  profile: Profile;
}

export interface Pick extends FlavorDrink {
  /** 0 to 100; null in the cold start. */
  match: number | null;
  reason: string;
}

/**
 * "For you": the drinks that fit your taste best, leaving out ones you've
 * ranked. `baseline` is the average drink (flavor_baseline); without one, the
 * average of `drinks`.
 */
export function forYou(
  drinks: readonly FlavorDrink[],
  taste: Taste,
  basis: TasteBasis,
  ranked: readonly string[],
  limit = 10,
  baseline: Profile | null = meanProfile(drinks.map((d) => d.profile))
): Pick[] {
  if (!dimsIn(taste).length) return [];
  const skip = new Set(ranked);
  return drinks
    .filter((d) => !skip.has(d.id))
    .map((d) => ({ d, gap: distance(taste, d.profile) }))
    .sort((a, b) => a.gap - b.gap || a.d.name.localeCompare(b.d.name))
    .slice(0, limit)
    .map(({ d }) => ({
      ...d,
      match: basis === 'ranked' ? matchPercent(taste, d.profile) : null,
      reason: matchReasons(taste, d.profile, basis, baseline),
    }));
}

/** The lowest public score a drink needs to count as "well ranked" for Most creative. */
export const CREATIVE_MIN_SCORE = 7;

export interface Creative extends FlavorDrink {
  /** How far its flavor is from the classic it's measured against, 0 to 1. */
  distance: number;
  from: string;
  /** Whether `from` is the classic it's a version of, or just the nearest one. */
  versionOf: boolean;
}

/**
 * "Most creative": among drinks people rank well (a public score of at least
 * CREATIVE_MIN_SCORE, which only exists once enough people have ranked it),
 * the ones whose flavor is furthest from a classic. Measured against the
 * classic a drink is a version of when it says, otherwise the nearest
 * classic's profile. Classics themselves aren't in the list.
 */
export function mostCreative(drinks: readonly FlavorDrink[], scores: Record<string, number>, limit = 10): Creative[] {
  const classics = drinks.filter((d) => d.isClassic);
  if (!classics.length) return [];
  const byId = new Map(classics.map((c) => [c.id, c]));
  const out: Creative[] = [];
  for (const d of drinks) {
    if (d.isClassic || (scores[d.id] ?? 0) < CREATIVE_MIN_SCORE) continue;
    const parent = d.riffOfId ? byId.get(d.riffOfId) : undefined;
    const base = parent ?? classics.reduce((best, c) => (distance(d.profile, c.profile) < distance(d.profile, best.profile) ? c : best));
    out.push({ ...d, distance: distance(d.profile, base.profile), from: base.name, versionOf: !!parent });
  }
  return out.sort((a, b) => b.distance - a.distance || a.name.localeCompare(b.name)).slice(0, limit);
}

/** A dimension's value as a word, so bars never pretend to more precision than they have. */
export function level(value: number): string {
  if (value < 0.15) return 'barely';
  if (value < 0.35) return 'a little';
  if (value < 0.6) return 'fairly';
  if (value < 0.8) return 'very';
  return 'intensely';
}
