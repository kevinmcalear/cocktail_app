import { isLocalSupabaseUrl } from "./localUrl.ts";

/**
 * Whether this function is running on a local Supabase stack. Local-only
 * behaviour (the mocked image model, the fixed worker secret) keys off this
 * instead of config.toml's [edge_runtime.secrets], because
 * `supabase secrets set` also uploads that section to production.
 */
export function isLocalStack(): boolean {
  return isLocalSupabaseUrl(Deno.env.get("SUPABASE_URL") ?? "");
}

/** The image-worker secret on a local stack (Vault holds the same value in tests). */
export const LOCAL_IMAGE_WORKER_SECRET = "local-image-worker-secret";

/** The image-palette secret on a local stack (supabase/seed.sql puts the same value in Vault). */
export const LOCAL_IMAGE_PALETTE_SECRET = "local-image-palette-secret";

/** The flavor-worker secret on a local stack (supabase/seed.sql puts the same value in Vault). */
export const LOCAL_FLAVOR_WORKER_SECRET = "local-flavor-worker-secret";

/** The sync-calendar secret on a local stack (supabase/seed.sql puts the same value in Vault). */
export const LOCAL_CALENDAR_SYNC_SECRET = "local-calendar-sync-secret";

/** The pair-notes secret on a local stack. */
export const LOCAL_PAIR_NOTES_SECRET = "local-pair-notes-secret";
