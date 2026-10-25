/**
 * "Claim it on your phone" (find-yourself step 4): a link, and its QR code,
 * that opens a person's claim on the claimant's own phone. Signed out, the
 * page remembers it on the device, so it opens again once they have signed in
 * with their own email (straight away, or at Setup's find step for a new
 * account). The storing is in claimReturn; this is the part with rules.
 */
export const CLAIM_RETURN_KEY = 'claim-return';
/** A link left unopened this long is forgotten: the next sign-in goes to the app as usual. */
const KEEP_MS = 24 * 60 * 60 * 1000;

export function claimPath(handle: string): string {
  return `/p/${encodeURIComponent(handle)}?claim=1`;
}

/** What to store for `handle`, made at `now`. */
export function claimRecord(handle: string, now: number): string {
  return JSON.stringify({ path: claimPath(handle), at: now });
}

/** The stored claim path, if it is one of ours and still fresh at `now`. */
export function readClaimReturn(stored: string | null, now: number): string | null {
  if (!stored) return null;
  try {
    const { path, at } = JSON.parse(stored) as { path?: unknown; at?: unknown };
    // Only our own claim paths: nothing stored can send someone elsewhere after sign-in.
    if (typeof path !== 'string' || typeof at !== 'number' || !/^\/p\/[^/?#]+\?claim=1$/.test(path)) return null;
    return now - at >= 0 && now - at <= KEEP_MS ? path : null;
  } catch {
    return null;
  }
}
