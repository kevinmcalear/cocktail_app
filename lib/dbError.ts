import { reportError } from './monitoring';

/**
 * A database refusal in its own words, when it has them. The app's triggers
 * and functions raise P0001 with messages written for people ("That name has
 * a word we don't allow. Please change it."); anything else gets the
 * caller's fallback.
 */
export function plainDbMessage(error: unknown): string | null {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === 'P0001' && e.message ? e.message : null;
}

const NETWORK = /network|fetch|timed? ?out|offline/i;

/**
 * What a failed save says to the person: the database's own words when they
 * were written for people (plainDbMessage), else one plain sentence for the
 * kind of failure. Never the raw error (a constraint's name, SQL): that goes
 * to the console, or to Sentry when it's on.
 */
export function saveErrorWords(error: unknown): string {
  const own = plainDbMessage(error);
  if (own) return own;
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  if (NETWORK.test(e?.message ?? '') && !code) return 'It didn’t reach the server. Check the signal and try again.';
  reportError(error, { where: 'save' });
  // Postgres: 23505 a name or key already used; 23xxx and 22xxx a value the table won't take; 42501 and PGRST301 not allowed.
  if (code === '23505') return 'One like it is already saved.';
  if (code.startsWith('23') || code.startsWith('22')) return 'Something in it is out of range, like a time or an amount. Check it and try again.';
  if (code === '42501' || code === 'PGRST301') return 'You can’t add that here. Someone who runs the venue can.';
  return 'Something went wrong saving it. Try again.';
}
