// Pure (no Deno or Node APIs), so the app's unit checks can import it.

/** Whether a Supabase URL is a local stack's (the CLI's kong, localhost or Docker host). */
export function isLocalSupabaseUrl(url: string): boolean {
  return /^http:\/\/(kong|localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
}
