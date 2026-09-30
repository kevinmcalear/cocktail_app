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
