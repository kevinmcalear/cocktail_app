/**
 * Signing in with a code from an email: the code's length, what a typed or
 * pasted code becomes, and what to say when Auth says no.
 */

/**
 * Digits in the emailed code. ponytail: must match Auth's otp_length
 * (supabase/config.toml, and the production project's auth settings). Read it
 * from the server if the two ever need to differ.
 */
export const CODE_LENGTH = 6;

/** Seconds before another code can be sent (Auth's own limit per address is 60). */
export const RESEND_AFTER = 60;

/** Digits only, at most CODE_LENGTH: a pasted "482 913" or "482-913" still works. */
export function cleanCode(text: string): string {
  return text.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/** A plausible email: something@something.something, no spaces. Auth checks the rest. */
export function emailLooksRight(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** What Auth sent back: its message, and its error code when it gave one. */
export type AuthProblem = { message: string; code?: string };

/** Asking for a code went wrong: what to tell the person. */
export function sendProblem(problem: AuthProblem): string {
  switch (problem.code) {
    case 'over_email_send_rate_limit':
      return 'We just sent you a code. Wait a minute, then ask for a new one.';
    case 'over_request_rate_limit':
      return 'Too many tries from here. Wait a few minutes and try again.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'That email doesn’t look right. Check it and try again.';
    case 'signup_disabled':
      return 'New accounts are paused right now. Try again later.';
    default:
      return problem.message || 'We couldn’t send a code. Check your connection and try again.';
  }
}

/** Checking a code went wrong: what to tell the person. */
export function verifyProblem(problem: AuthProblem): string {
  switch (problem.code) {
    case 'otp_expired':
    case 'otp_disabled':
      return 'That code doesn’t match. If you asked for more than one, only the newest email works.';
    case 'over_request_rate_limit':
      return 'Too many tries from here. Wait a few minutes and try again.';
    default:
      return /expired|invalid/i.test(problem.message)
        ? 'That code doesn’t match. If you asked for more than one, only the newest email works.'
        : problem.message || 'We couldn’t check the code. Check your connection and try again.';
  }
}

/**
 * A new account's first sign-in: its email was confirmed by the code just
 * used. An existing account confirmed it long before this sign-in.
 */
export function isFirstSignIn(user: { email_confirmed_at?: string; last_sign_in_at?: string }): boolean {
  if (!user.email_confirmed_at || !user.last_sign_in_at) return false;
  return Math.abs(Date.parse(user.last_sign_in_at) - Date.parse(user.email_confirmed_at)) < 10_000;
}
