/**
 * First run's taste (canvas Prod-first 3 to 5, decided 31 Oct): pick five
 * drinks you've had, say which you like more in three pairs, and get one line
 * about your taste. Nothing else is filled in. The answer is a taste like the
 * old quick questions made (user_prefs.taste_answers), worked out from the
 * drinks' flavour profiles: the five you know count once, the one you liked
 * more in each pair counts twice more. Checked by lib/firstRun.check.ts.
 */

import { LABEL, QUICK_QUESTIONS, type Dimension, type Profile, type Taste } from '@/lib/flavor';

/** The nine catalog classics "Which have you had?" offers, in the board's order. */
export const FIRST_RUN_DRINKS = ['Negroni', 'Martini', 'Old Fashioned', 'Daiquiri', 'Penicillin', 'Aperol Spritz', 'Clover Club', 'Last Word', "Bee's Knees"] as const;

/** What the board calls a drink where that differs from the catalog's name. */
export const FIRST_RUN_LABELS: Partial<Record<(typeof FIRST_RUN_DRINKS)[number], string>> = { Martini: 'House Martini' };

/** How many to pick, and how many pairs to ask. */
export const PICKS = 5;
export const PAIRS = 3;
/** Then ten drinks to swipe Want or Not for me on (board Loop-want, "In onboarding"). */
export const SWIPES = 10;

/** How far a swipe card goes before letting go answers it. */
export const FLING = 110;

export interface PickedDrink {
  id: string;
  /** stir, shake, build…: from its drawing inputs, when it has them. */
  method: string | null;
  profile: Profile | null;
}

/** "Stirred", "Shaken": a pair card's eyebrow. Null for a method with no word people use here. */
export function methodWord(method: string | null): string | null {
  if (method === 'stir') return 'Stirred';
  if (method === 'shake') return 'Shaken';
  if (method === 'build') return 'Built';
  return null;
}

/** "Bitter, sweet": a drink's two strongest flavours (not strength), for a pair card. */
export function flavourWords(profile: Profile | null): string | null {
  if (!profile) return null;
  const top = (Object.keys(profile) as Dimension[])
    .filter((d) => d !== 'strong')
    .sort((a, b) => profile[b] - profile[a])
    .slice(0, 2)
    .filter((d) => profile[d] > 0);
  if (!top.length) return null;
  const words = top.map((d) => LABEL[d]);
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words[1] ? `, ${words[1]}` : '');
}

const distance = (a: Profile | null, b: Profile | null) =>
  a && b ? (Object.keys(a) as Dimension[]).reduce((sum, d) => sum + Math.abs(a[d] - (b[d] ?? 0)), 0) : 0;

/**
 * Three pairs from the five picked: the most different first (stirred against
 * shaken, then the furthest apart in flavour), each drink in as few pairs as
 * it can be, so all five are asked about.
 */
export function pairsFor(picks: readonly PickedDrink[]): [string, string][] {
  const all: { a: PickedDrink; b: PickedDrink; score: number }[] = [];
  for (let i = 0; i < picks.length; i++)
    for (let j = i + 1; j < picks.length; j++) {
      const a = picks[i];
      const b = picks[j];
      all.push({ a, b, score: (a.method && b.method && a.method !== b.method ? 10 : 0) + distance(a.profile, b.profile) });
    }
  all.sort((x, y) => y.score - x.score);
  const used = new Map<string, number>();
  const out: [string, string][] = [];
  while (out.length < PAIRS && all.length) {
    // Least asked-about drinks first, then the most different.
    const uses = (p: { a: PickedDrink; b: PickedDrink }) => (used.get(p.a.id) ?? 0) + (used.get(p.b.id) ?? 0);
    let best = 0;
    for (let k = 1; k < all.length; k++) if (uses(all[k]) < uses(all[best])) best = k;
    const [p] = all.splice(best, 1);
    out.push([p.a.id, p.b.id]);
    used.set(p.a.id, (used.get(p.a.id) ?? 0) + 1);
    used.set(p.b.id, (used.get(p.b.id) ?? 0) + 1);
  }
  return out;
}

/** The quick questions' dimensions: what setup's taste has always covered, and what You's taste page shows first. */
const ASKED = QUICK_QUESTIONS.map((q) => q.dim);

/**
 * The taste the picks and pairs add up to: each picked drink once, each
 * pair's winner twice more, each drink swiped Want once, averaged per
 * dimension and rounded to two places. Empty when no picked drink has a
 * flavour profile yet.
 */
export function tasteFrom(picks: readonly PickedDrink[], winners: readonly string[], wanted: readonly (Profile | null)[] = []): Taste {
  const weighted: { profile: Profile; w: number }[] = wanted.flatMap((profile) => (profile ? [{ profile, w: 1 }] : []));
  for (const p of picks) {
    if (!p.profile) continue;
    weighted.push({ profile: p.profile, w: 1 + 2 * winners.filter((id) => id === p.id).length });
  }
  const total = weighted.reduce((s, x) => s + x.w, 0);
  if (!total) return {};
  const taste: Taste = {};
  for (const d of ASKED) taste[d] = Math.round((weighted.reduce((s, x) => s + x.profile[d] * x.w, 0) / total) * 100) / 100;
  return taste;
}

/**
 * "You like it bitter and stirred.": the strongest flavour of the taste, and
 * how the drinks you liked more are made when most of them are made one way
 * (else the second flavour). Null with nothing to say.
 */
export function tasteLine(taste: Taste, winnerMethods: readonly (string | null)[]): string | null {
  const dims = (Object.keys(taste) as Dimension[]).filter((d) => d !== 'strong').sort((a, b) => taste[b]! - taste[a]!);
  if (!dims.length || !taste[dims[0]]) return null;
  const counts = new Map<string, number>();
  for (const m of winnerMethods) if (m && methodWord(m)) counts.set(m, (counts.get(m) ?? 0) + 1);
  const [method, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const how = method && n * 2 > winnerMethods.length ? methodWord(method)!.toLowerCase() : dims[1] && taste[dims[1]] ? LABEL[dims[1]] : null;
  return how ? `You like it ${LABEL[dims[0]]} and ${how}.` : `You like it ${LABEL[dims[0]]}.`;
}
