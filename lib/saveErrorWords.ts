import { plainDbMessage } from './dbError';
import { reportError } from './monitoring';

// Apart from dbError so the screens that only read a refusal's own words (plainDbMessage) don't load this.
const NETWORK = /network|fetch|timed? ?out|offline/i;

/**
 * What a failed save says to the person: the database's own words when they
 * were written for people (plainDbMessage), or the app's own (an Error the
 * app threw, "Sign in to save drinks."), else one plain sentence for the
 * kind of failure. Never the raw error (a constraint's name, SQL): a failure
 * that's a bug goes to the console, or to Sentry when it's on.
 */
export function saveErrorWords(error: unknown): string {
  const own = plainDbMessage(error);
  if (own) return own;
  const e = error as { code?: string; message?: string; name?: string } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  const message = e?.message ?? '';
  if (!code && NETWORK.test(message)) return 'It didn’t reach the server. Check the signal and try again.';
  // Postgres: 23505 a name or key already used; 42501 a row the venue's rules refuse. Both are answers, not bugs.
  if (code === '23505') return 'One like it is already saved.';
  if (code === '42501') return 'You can’t add that here. Someone who runs the venue can.';
  // Thrown by the app itself, in words for people (a plain Error, no database code); a TypeError and the like is a bug.
  // ponytail: trusts every plain Error, so a hook that wraps a raw message (new Error(error.message)) would show it.
  // No save path does today. Upgrade: an app-words error class thrown by the save hooks, and pass only that.
  if (!code && error instanceof Error && error.name === 'Error' && message) return message;
  reportError(error, { where: 'save' });
  // 23514 a check (the cold shrub's rest timer), 22xxx a value the column won't hold.
  if (code === '23514' || code.startsWith('22')) return 'Something in it is out of range, like a time or an amount. Check it and try again.';
  return 'Something went wrong saving it. Try again.';
}
