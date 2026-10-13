import { useQuery } from '@tanstack/react-query';

import { useSignedIn } from '@/ctx/AuthContext';
import { isShareSlug, isUuid, type ShareKind } from '@/lib/menuPreview';
import { supabase } from '@/lib/supabase';

// Readable shared links: /d/penicillin, /m/halloween-party
// (supabase/migrations/20261016300000_share_slugs.sql). A uuid link keeps working.

export const shareSlugKey = (kind: ShareKind, id: string | null | undefined) => ['share-slug', kind, id] as const;

/** Asks the server for a public drink's or shared menu's slug, made on first ask. Null when it isn't public. */
export async function fetchShareSlug(kind: ShareKind, id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('share_slug', { p_kind: kind, p_id: id });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/**
 * The slug for sharing a drink or menu, ready before the button is pressed
 * (a browser only shares or copies straight from the tap). Null while it's
 * asked, and for one that isn't public: share the id link then.
 */
export function useShareSlug(kind: ShareKind, id: string | null | undefined, enabled = true) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: shareSlugKey(kind, id),
    enabled: signedIn && enabled && isUuid(id),
    // A slug never changes once made; a drink that turns public later asks again on the next visit.
    staleTime: 10 * 60_000,
    queryFn: () => fetchShareSlug(kind, id!),
  });
}

/**
 * The id behind a link's last part, as anyone reads it: a uuid is itself, a
 * slug is asked of share_target(), which answers only for a drink that's
 * published or a menu that's shared. Null for anything else, so the page
 * says Not available.
 */
export async function resolveShareKey(kind: ShareKind, key: string): Promise<string | null> {
  if (isUuid(key)) return key;
  if (!isShareSlug(key)) return null;
  const { data, error } = await supabase.rpc('share_target', { p_kind: kind, p_slug: key });
  if (error) throw error;
  return isUuid(data as string | null) ? (data as string) : null;
}
