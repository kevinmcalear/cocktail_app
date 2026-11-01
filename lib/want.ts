/**
 * Want or not (Loop-want): the words and sorting behind the want swipe, the
 * match block on a drink page and the Want list. Pure, so it is checked by
 * lib/want.check.ts. Queries are in hooks/useWant.ts.
 */
import { foldName } from './discover';
import { DIMENSIONS, LABEL, type Dimension, type Profile, type Taste } from './flavor';
import { formatDistance } from './nearMe';

export type Swipe = 'want' | 'pass';

/** A let-go card counts past this share of its width... */
export const SWIPE_SHARE = 0.3;
/** ...or when flicked at least this fast (points a second) the same way. */
export const FLICK = 800;

/** What letting go of a card at `dx` (right is +) moving at `vx` does: Want, Not for me, or spring back. */
export function swipeOutcome(dx: number, vx: number, width: number): Swipe | null {
  'worklet';
  const past = Math.abs(dx) > width * SWIPE_SHARE;
  const flicked = Math.abs(vx) > FLICK && Math.sign(vx) === Math.sign(dx);
  if (!past && !flicked) return null;
  return dx > 0 ? 'want' : 'pass';
}

/** "92% match", or nothing when there is no taste to match yet. */
export function matchLabel(pct: number | null | undefined): string | null {
  return pct == null ? null : `${pct}% match`;
}

/** The end of the deck: "4 on your Want list. We'll tell you when one is on near you." */
export function endLine(wanted: number): string {
  if (wanted <= 0) return 'Nothing on your Want list yet. Swipe again when you like.';
  if (wanted === 1) return '1 on your Want list. We’ll tell you when it’s on near you.';
  return `${wanted} on your Want list. We’ll tell you when one is on near you.`;
}

const list = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : (words[0] ?? ''));

/** The two strongest things in a taste, for "You like it bitter and strong." Empty when it says nothing. */
export function tasteWords(taste: Taste): string[] {
  return DIMENSIONS.filter((d) => (taste[d] ?? 0) >= 0.4)
    .sort((a, b) => (taste[b] ?? 0) - (taste[a] ?? 0))
    .slice(0, 2)
    .map((d) => LABEL[d]);
}

/** Onboarding's end: "You like it bitter and strong. Every drink now shows a match." */
export function onboardingLine(taste: Taste | null): string {
  const words = taste ? tasteWords(taste) : [];
  return words.length ? `You like it ${list(words)}. Every drink now shows a match.` : 'Every drink now shows a match.';
}

/**
 * Why a drink matches, as the drink page's match row says it: "You like
 * sour, fruity, not too sweet". What you and the drink both have plenty of
 * (two at most), then one you keep low that it does too. Null when nothing fits.
 */
export function likeLine(taste: Taste, profile: Profile): string | null {
  const has = (d: Dimension) => typeof taste[d] === 'number';
  const shared = DIMENSIONS.filter((d) => has(d) && taste[d]! >= 0.4 && profile[d] >= 0.4)
    .sort((a, b) => Math.min(taste[b]!, profile[b]) - Math.min(taste[a]!, profile[a]))
    .slice(0, 2);
  const low = DIMENSIONS.filter((d) => has(d) && !shared.includes(d) && taste[d]! <= 0.25 && profile[d] <= 0.3).sort((a, b) => taste[a]! - taste[b]!)[0];
  const words = [...shared.map((d) => LABEL[d]), ...(low ? [`not too ${LABEL[low]}`] : [])];
  return words.length ? `You like ${words.join(', ')}` : null;
}

/** A bar near you pouring a wanted drink (or its bar's version of it) on a menu now. Plain JSON. */
export interface NearBar {
  /** The bar's drink: its page. */
  drinkId: string;
  barId: string;
  barName: string;
  barLogo: string | null;
  /** Kilometres away, when the list knew where you are. */
  km: number | null;
}

/** The discover_list columns nearBars reads. */
export interface NearRow {
  id: string;
  name: string;
  bar_profile_id: string;
  bar_name: string;
  bar_logo: string | null;
  match_kind?: string | null;
  match_text?: string | null;
  distance_m?: number | null;
}

/**
 * The bars in a "what's on near me" search for `name` that really pour it:
 * the drink's own name holds it, or it is a version of the classic by that
 * name. A word that only turns up in a description doesn't count. One row
 * per bar, its nearest drink; nearest bar first.
 */
export function nearBars(rows: readonly NearRow[], name: string): NearBar[] {
  const want = foldName(name);
  const pours = (r: NearRow) => foldName(r.name).includes(want) || (r.match_kind === 'riff' && foldName(r.match_text ?? '') === want);
  const byBar = new Map<string, NearBar>();
  for (const r of rows) {
    if (!want || !pours(r)) continue;
    const km = r.distance_m == null ? null : r.distance_m / 1000;
    const had = byBar.get(r.bar_profile_id);
    if (had && (had.km ?? Infinity) <= (km ?? Infinity)) continue;
    byBar.set(r.bar_profile_id, { drinkId: r.id, barId: r.bar_profile_id, barName: r.bar_name, barLogo: r.bar_logo, km });
  }
  return [...byBar.values()].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || a.barName.localeCompare(b.barName));
}

/** A bar row's line: "Tonight · 0.5 mi". */
export function nearLine(bar: Pick<NearBar, 'km'>, miles: boolean): string {
  return bar.km == null ? 'Tonight' : `Tonight · ${formatDistance(bar.km, miles)}`;
}

/** A Want list row's line: "Little Rye · tonight · 88% match", or just "92% match". */
export function wantRowLine(near: Pick<NearBar, 'barName'> | null | undefined, match: string | null): string {
  return [near ? `${near.barName} · tonight` : null, match].filter(Boolean).join(' · ');
}

/** A row on the deck's end: "Want · on at Little Rye", or "Want". */
export function wantedLine(near: Pick<NearBar, 'barName'> | null | undefined): string {
  return near ? `Want · on at ${near.barName}` : 'Want';
}

/** The Want list's two groups: on near you now (nearest first), and the rest in their own order. */
export function splitNear<T extends { itemId: string | null }>(drinks: readonly T[], near: Readonly<Record<string, NearBar[]>>): { on: T[]; notYet: T[] } {
  const first = (d: T) => (d.itemId ? near[d.itemId]?.[0] : undefined);
  const on = drinks.filter((d) => first(d)).sort((a, b) => (first(a)!.km ?? Infinity) - (first(b)!.km ?? Infinity));
  return { on, notYet: drinks.filter((d) => !first(d)) };
}

/** "You · 12 drinks". */
export function wantCount(n: number): string {
  return `You · ${n} ${n === 1 ? 'drink' : 'drinks'}`;
}
