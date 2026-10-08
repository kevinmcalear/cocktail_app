/**
 * The magic eight ball (issue #18): shake the phone, get a drink. Pure parts
 * only: telling a shake from a bump, building the pool of drinks with their
 * weights, and a weighted pick that doesn't repeat itself. Checked by
 * lib/eightBall.check.ts; the data comes from hooks/useEightBall.ts and the
 * accelerometer from lib/shake.ts.
 */

// --- shake detection ---

export interface Motion {
  /** Acceleration in g, gravity included (about 1 at rest). */
  x: number;
  y: number;
  z: number;
  /** Milliseconds. */
  at: number;
}

export interface ShakeState {
  /** When the last strong jolt was. */
  lastJolt: number;
  /** Strong jolts in the current run. */
  jolts: number;
  /** When the last shake fired (-Infinity before the first). */
  lastShake: number;
}

export const SHAKE = {
  /** A jolt is a reading this far from 1 g. A firm wrist shake reaches 2 to 3 g. */
  threshold: 1.4,
  /** Jolts closer together than this belong to one shake... */
  windowMs: 500,
  /** ...and it takes this many, so a bump or a set-down doesn't count. */
  jolts: 3,
  /** Quiet time after a shake, so one shake is one drink. */
  cooldownMs: 1500,
} as const;

export const NO_SHAKE: ShakeState = { lastJolt: 0, jolts: 0, lastShake: -Infinity };

/** Feed each reading in; `shook` is true on the reading that completes a shake. */
export function readShake(state: ShakeState, m: Motion): { state: ShakeState; shook: boolean } {
  const force = Math.abs(Math.sqrt(m.x * m.x + m.y * m.y + m.z * m.z) - 1);
  if (m.at - state.lastShake < SHAKE.cooldownMs) return { state, shook: false };
  if (force < SHAKE.threshold) return { state, shook: false };
  const jolts = state.jolts > 0 && m.at - state.lastJolt <= SHAKE.windowMs ? state.jolts + 1 : 1;
  if (jolts >= SHAKE.jolts) return { state: { lastJolt: 0, jolts: 0, lastShake: m.at }, shook: true };
  return { state: { ...state, lastJolt: m.at, jolts }, shook: false };
}

// --- the pool ---

export interface EightBallDrink {
  id: string;
  name: string;
  imageUrl: string | null;
  glass: string | null;
}

export interface Candidate extends EightBallDrink {
  weight: number;
  /** Why this drink, in a line: "You have all the bottles at home.", "A classic from 1919, by Pascal Olivier Count de Negroni." */
  reason: string;
}

/** A catalog classic from the family tree (hooks/useDrinkTree.ts). Every one has a spec. */
export interface Classic extends EightBallDrink {
  year: number | null;
  approx: boolean;
  creator: string | null;
  bar: string | null;
}

export interface RatedBar {
  id: string;
  name: string;
  /** Bar score, 0 to 10. */
  score: number;
}

export interface PoolInput {
  /** The classics, from the drink history. */
  classics: Classic[];
  /** What the shelf makes (my_bar_drinks): specs the person can make tonight. */
  canMake: EightBallDrink[];
  /** Drinks at well-rated bars whose spec the person can see, with the bar they come from. */
  barDrinks: (EightBallDrink & { barId: string })[];
  /** Well-ranked bars, near the person when we know where they are. */
  ratedBars: RatedBar[];
  /** "near you" or "anywhere", for the reason line. */
  near: boolean;
}

/** Weights: what you can make tonight first, then what's well rated nearby, then the classics. */
export const WEIGHT = { canMake: 6, ratedBar: 2, classic: 1 } as const;

/** "Make a Negroni", "Make an Old Fashioned", "Make A Bird in the Hand". */
export function makeA(name: string): string {
  if (/^(a|an|the)\s/i.test(name)) return `Make ${name}`;
  return `Make ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

/** "A classic from about 1880.", "A classic from 2005, by Sam Ross at Milk & Honey.", "A classic from the drink history." */
export function classicReason({ year, approx, creator, bar }: Pick<Classic, 'year' | 'approx' | 'creator' | 'bar'>): string {
  const when = year ? ` from ${approx ? 'about ' : ''}${year}` : '';
  const who = [creator && `by ${creator}`, bar && `at ${bar}`].filter(Boolean).join(' ');
  if (!when && !who) return 'A classic from the drink history.';
  return `A classic${when}${who ? `, ${who}` : ''}.`;
}

/**
 * Only drinks with a spec the person can follow: classics, what their
 * shelf makes, and rated bars' drinks whose spec they can see.
 */
export function buildPool({ classics, canMake, barDrinks, ratedBars, near }: PoolInput): Candidate[] {
  const pool = new Map<string, Candidate>();
  for (const c of classics) {
    pool.set(c.id, { id: c.id, name: c.name, imageUrl: c.imageUrl, glass: c.glass, weight: WEIGHT.classic, reason: classicReason(c) });
  }
  const bars = new Map(ratedBars.map((b) => [b.id, b]));
  for (const d of barDrinks) {
    const bar = bars.get(d.barId);
    if (!bar) continue;
    // A 9.5 bar's drink comes up about twice as often as a 5's.
    const weight = WEIGHT.ratedBar * (1 + Math.max(0, Math.min(bar.score, 10)) / 10);
    pool.set(d.id, { id: d.id, name: d.name, imageUrl: d.imageUrl, glass: d.glass, weight, reason: `${near ? 'Well rated near you' : 'Well rated'}, at ${bar.name}.` });
  }
  for (const d of canMake) pool.set(d.id, { ...d, weight: WEIGHT.canMake, reason: 'You have all the bottles at home.' });
  return [...pool.values()];
}

/**
 * One drink, by weight, skipping the ones just shown (unless that's all
 * there is). `random` is injectable for the check.
 */
export function pickDrink(pool: readonly Candidate[], recent: readonly string[] = [], random: () => number = Math.random): Candidate | null {
  const fresh = pool.filter((c) => !recent.includes(c.id) && c.weight > 0);
  const from = fresh.length ? fresh : pool.filter((c) => c.weight > 0);
  const total = from.reduce((sum, c) => sum + c.weight, 0);
  if (!total) return null;
  let r = random() * total;
  for (const c of from) {
    r -= c.weight;
    if (r < 0) return c;
  }
  return from[from.length - 1];
}

/** How many recent picks "Another" avoids. */
export const RECENT = 8;

/** The eight ball's own lines, shown while it thinks. */
export const FORTUNES = ['Signs point to…', 'It is decidedly…', 'Without a doubt…', 'Outlook good…', 'The spirits say…'];
