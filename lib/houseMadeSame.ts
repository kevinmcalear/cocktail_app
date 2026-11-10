import type { HouseMadeDraft } from './houseMadeDraft';

// Apart from houseMadeDraft: that file is in every page's first load, this is only needed when a save lands.

/**
 * The kept draft is still the one that was saved: the same name and recipe
 * as when Save was pressed. Picked up again and stepped through while the
 * save waited for signal (its step and time change, not what's in it), it
 * goes once the save is in (it used to stay listed, its name taken); one
 * written in since stays, with what was written.
 */
export const sameHouseMade = (a: HouseMadeDraft, b: HouseMadeDraft) => JSON.stringify(keysInOrder(a)) === JSON.stringify(keysInOrder(b));

/** The same JSON whatever order its keys came in: a draft read back from the account comes in the database's order. */
const keysInOrder = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(keysInOrder) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, keysInOrder((v as Record<string, unknown>)[k])])) : v;

