/**
 * Your taste and how well a drink fits it (consumer discovery, "For you").
 *
 * Every drink with a spec gets a flavor profile on the server: nine
 * dimensions, 0 to 1 (supabase/functions/_shared/flavor.ts has the rules).
 * Your taste is the same nine dimensions, averaged over the drinks you ranked
 * and weighted by their score, so the drinks at the top of your lists count
 * most (get_my_taste). Until you've ranked enough drinks, a few quick
 * questions stand in for it, and we don't show a match percentage.
 */

export const DIMENSIONS = ['sweet', 'sour', 'bitter', 'strong', 'herbal', 'fruity', 'smoky', 'spicy', 'creamy'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type Profile = Record<Dimension, number>;
/** A taste can be partial: quick answers only cover some dimensions. */
export type Taste = Partial<Record<Dimension, number>>;

export const LABEL: Record<Dimension, string> = {
  sweet: 'sweet',
  sour: 'sour',
  bitter: 'bitter',
  strong: 'strong',
  herbal: 'herbal',
  fruity: 'fruity',
  smoky: 'smoky',
  spicy: 'spicy',
  creamy: 'creamy',
};

/** Profiles that understood less than this share of their spec aren't used. Mirrors get_my_taste. */
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

/**
 * Your taste: from your rankings once there are enough, otherwise your quick
 * answers, blended in as rankings arrive.
 */
export function blendTaste(ranked: Taste | null, rankedDrinks: number, answers: Taste | null): { taste: Taste; basis: TasteBasis } {
  if (rankedDrinks >= COLD_START_DRINKS || !answers || !dimsIn(answers).length) return { taste: ranked ?? {}, basis: 'ranked' };
  const share = ranked ? rankedDrinks / COLD_START_DRINKS : 0;
  const taste: Taste = {};
  for (const d of DIMENSIONS) {
    const r = ranked?.[d];
    const a = answers[d];
    if (typeof a === 'number' && typeof r === 'number') taste[d] = r * share + a * (1 - share);
    else if (typeof a === 'number') taste[d] = a;
    else if (typeof r === 'number' && share > 0) taste[d] = r;
  }
  return { taste, basis: 'answers' };
}

/** A quick question for the cold start. Each answer sets one dimension of your taste. */
export interface TasteQuestion {
  dim: Dimension;
  prompt: string;
}

export const QUESTIONS: readonly TasteQuestion[] = [
  { dim: 'bitter', prompt: 'Bitter, like a Negroni?' },
  { dim: 'sour', prompt: 'Sour and bright, like a Daiquiri?' },
  { dim: 'sweet', prompt: 'Sweet?' },
  { dim: 'strong', prompt: 'Strong and stirred, like an Old Fashioned?' },
  { dim: 'smoky', prompt: 'Smoky, like mezcal?' },
  { dim: 'creamy', prompt: 'Creamy, like a Piña Colada?' },
];

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

/** "For you": the drinks that fit your taste best, leaving out ones you've ranked. */
export function forYou(drinks: readonly FlavorDrink[], taste: Taste, basis: TasteBasis, ranked: readonly string[], limit = 10): Pick[] {
  if (!dimsIn(taste).length) return [];
  const skip = new Set(ranked);
  const baseline = meanProfile(drinks.map((d) => d.profile));
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
