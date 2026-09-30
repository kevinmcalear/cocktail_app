/** Pull auth params from query string and/or hash fragment. */
export function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  const query = q >= 0 ? url.slice(q + 1, h >= 0 && h > q ? h : undefined) : '';
  const hash = h >= 0 ? url.slice(h + 1) : '';
  for (const part of [query, hash]) {
    if (!part) continue;
    new URLSearchParams(part).forEach((v, k) => {
      out[k] = v;
    });
  }
  return out;
}

export type AuthLinkState = {
  url: string | null;
  error: string | null;
  /** code, or token_hash with its type, is present: needs a user gesture to exchange */
  hasCredential: boolean;
};

function humanizeAuthError(params: Record<string, string>): string | null {
  const raw = params.error_description || params.error;
  if (!raw) return null;
  const text = decodeURIComponent(raw.replace(/\+/g, ' '));
  if (/otp_expired|invalid|expired/i.test(params.error_code || text)) {
    return 'This email link is invalid or has already been used. Request a new one — and open it in your browser (mail app previews often burn the link).';
  }
  return text;
}

/**
 * What an email link can do. A token_hash is useless without its `type`
 * (verifyOtp needs both), and links do arrive without it: an unquoted `&` in
 * a shell or a mail client's rewrite cuts the URL before `type=`. Call that a
 * broken link up front instead of letting the Continue tap exchange nothing.
 */
export function inspectAuthUrl(url: string | null | undefined): AuthLinkState {
  if (!url) return { url: null, error: null, hasCredential: false };
  const params = parseAuthParams(url);
  const hasCode = !!params.code;
  const hasTokenHash = !!params.token_hash;
  const hasType = !!params.type;
  let error = humanizeAuthError(params);
  if (!error && hasTokenHash && !hasType && !hasCode) {
    error = 'This link arrived incomplete. Open it from your email again.';
  }
  return { url, error, hasCredential: hasCode || (hasTokenHash && hasType) };
}
