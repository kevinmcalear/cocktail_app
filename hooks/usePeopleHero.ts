import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

// The photo someone posted that leads for a drink with no photo of its own
// (get_people_heroes, supabase/migrations/20261008500100_drink_photos.sql),
// for cards and thumbnails. The drink page picks the same way (heroPictures).

const CHUNK = 200;
let pending: { ids: Set<string>; result: Promise<Map<string, string>> } | null = null;

async function fetchMany(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase.rpc('get_people_heroes', { p_item_ids: ids.slice(i, i + CHUNK) });
    // Decorative: on an error the card keeps its drawing.
    if (error) continue;
    for (const row of (data ?? []) as { item_id: string; image_url: string }[]) out.set(row.item_id, row.image_url);
  }
  return out;
}

/** Every card asking in the same tick shares one request. */
function load(id: string): Promise<string | null> {
  if (!pending) {
    const ids = new Set<string>();
    const result = new Promise<Map<string, string>>((resolve) => {
      setTimeout(() => {
        pending = null;
        fetchMany([...ids]).then(resolve, () => resolve(new Map()));
      }, 16);
    });
    pending = { ids, result };
  }
  pending.ids.add(id);
  return pending.result.then((m) => m.get(id) ?? null);
}

/**
 * The URL of the photo that leads for a drink with no photo of its own, or
 * null. Signed in only, and per viewer (blocks hide photos), so it's kept in
 * memory and never saved with the query cache.
 */
export function usePeopleHero(itemId: string | null | undefined) {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: ['people-hero', userId, itemId],
    enabled: !!userId && !!itemId,
    staleTime: 10 * 60_000,
    meta: { persist: false },
    queryFn: () => load(itemId!),
  });
}
