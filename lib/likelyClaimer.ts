/**
 * Who gets a page's claim prompts up front (Q33, approved 26 Oct 2026): "See
 * your name?" on a bar's page and This is me on a person's show only to the
 * likely person. Everyone else finds them in the page's More and one quiet
 * line at its end. Checked by lib/likelyClaimer.check.ts.
 */

/** What "What brings you here?" answered in setup, kept in the account's metadata (`setup_answer`). */
export type SetupAnswer = 'owner' | 'bartender' | 'drinks';

const ANSWERS: readonly SetupAnswer[] = ['owner', 'bartender', 'drinks'];

export function readSetupAnswer(metadata: unknown): SetupAnswer | null {
  const v = metadata && typeof metadata === 'object' ? (metadata as { setup_answer?: unknown }).setup_answer : null;
  return ANSWERS.includes(v as SetupAnswer) ? (v as SetupAnswer) : null;
}

/** Someone who said they run a bar or make drinks at one. */
export function worksInBars(answer: SetupAnswer | null): boolean {
  return answer === 'owner' || answer === 'bartender';
}

/** "José  O'Neil" and "jose o neil" are the same name: case, accents, punctuation and spacing aside. */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The viewer's own names, as keys: their profile's name and the full name
 * setup saved (or first and last). One-word names don't count: "Sam" would
 * match half the credits.
 */
export function viewerNameKeys(metadata: unknown, profileName: string | null | undefined): string[] {
  const m = (metadata && typeof metadata === 'object' ? metadata : {}) as { full_name?: unknown; first_name?: unknown; last_name?: unknown };
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const names = [profileName ?? '', text(m.full_name), `${text(m.first_name)} ${text(m.last_name)}`];
  return [...new Set(names.map(nameKey).filter((k) => k.includes(' ')))];
}

/** One of the viewer's names is one of these (a page's name, or the people credited at a bar). */
export function namesMatch(viewer: readonly string[], names: readonly string[]): boolean {
  if (!viewer.length) return false;
  const keys = new Set(viewer);
  return names.some((n) => keys.has(nameKey(n)));
}
