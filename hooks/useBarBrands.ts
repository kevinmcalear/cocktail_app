import { useQuery } from '@tanstack/react-query';

import { toPublicBrand, type PublicBrand, type PublicBrandRow } from '@/lib/brand';
import { supabase } from '@/lib/supabase';

/** The public brands of these bar pages (bar_brands), by profile id; a page with none is left out. Works signed out. */
export async function readBarBrands(profileIds: readonly string[]): Promise<Record<string, PublicBrand>> {
  if (!profileIds.length) return {};
  const { data, error } = await supabase.rpc('bar_brands', { p_profile_ids: [...new Set(profileIds)] });
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as PublicBrandRow[]).map((r) => [r.profile_id, toPublicBrand(r)]));
}

// The marks on one screen ask together: ids asked for in the same tick go in one read.
let waiting: Map<string, { resolve: (b: PublicBrand | null) => void; reject: (e: unknown) => void }[]> | null = null;

function flush() {
  const batch = waiting!;
  waiting = null;
  readBarBrands([...batch.keys()]).then(
    (brands) => batch.forEach((asks, id) => asks.forEach((a) => a.resolve(brands[id] ?? null))),
    (e: unknown) => batch.forEach((asks) => asks.forEach((a) => a.reject(e)))
  );
}

function brandOf(profileId: string): Promise<PublicBrand | null> {
  return new Promise((resolve, reject) => {
    if (!waiting) {
      waiting = new Map();
      setTimeout(flush, 0);
    }
    waiting.set(profileId, [...(waiting.get(profileId) ?? []), { resolve, reject }]);
  });
}

/**
 * A bar page's public brand: its venue's logo, accent and face, for anyone
 * (Kevin, 12 Oct). Null for a page with no venue on the app, and while it
 * loads. Many on one screen share a read. Undefined asks nothing.
 */
export function useBarBrand(profileId: string | null | undefined): PublicBrand | null {
  const { data } = useQuery({
    queryKey: ['bar-brand', profileId],
    enabled: !!profileId,
    staleTime: 60 * 60 * 1000,
    // Public: kept when someone signs out, like useVenueBranding.
    meta: { public: true },
    queryFn: () => brandOf(profileId!),
  });
  return data ?? null;
}
