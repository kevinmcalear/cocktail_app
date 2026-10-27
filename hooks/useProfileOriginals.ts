// Drinks credited to a profile: its originals and what a person made.
// Split out of hooks/useProfiles.ts, which still re-exports it.
import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { LINEAGE_COLUMNS, PROFILE_COLUMNS } from '@/hooks/useLineage';
import { viewerScoped } from '@/lib/authCache';
import type { ItemImageLink } from '@/lib/itemImages';
import type { CreditProfile, CreditStatus, LineageDrink } from '@/lib/lineage';
import { supabase } from '@/lib/supabase';

export interface Original extends LineageDrink {
  item_type: string;
  description: string | null;
  glass: { icon_key: string | null } | null;
  item_images: ItemImageLink[] | null;
  /** How many drinks name it as their classic (riffs and bar versions you can see): "riffed 12×". */
  versions?: { count: number }[] | null;
}

const ORIGINAL_COLUMNS = `${LINEAGE_COLUMNS}, item_type, description, glass:glassware_id(icon_key), item_images(angle, sort_order, is_generated, outdated_since, images(url)), versions:items!riff_of_id(count)`;

/** The `or` filters for drinks credited to a profile: its creator, its first bar, or one of several creators who said yes. */
async function creditedTo(profileId: string): Promise<string[]> {
  const co = await supabase.from('item_co_creators').select('item_id').eq('profile_id', profileId).eq('status', 'accepted').limit(100);
  if (co.error) throw co.error;
  const coIds = (co.data ?? []).map((r) => r.item_id as string);
  return [`creator_profile_id.eq.${profileId}`, `origin_bar_profile_id.eq.${profileId}`, ...(coIds.length ? [`id.in.(${coIds.join(',')})`] : [])];
}

interface PublicOriginalRow {
  id: string;
  name: string;
  item_type: string;
  description: string | null;
  origin: string | null;
  origin_year: number | null;
  riff_of_id: string | null;
  credit_status: CreditStatus | null;
  creator_profile_id: string | null;
  origin_bar_profile_id: string | null;
  image_url: string | null;
  image_is_generated: boolean | null;
}

/**
 * Signed out: the same drinks' public cards (published_items), with who made
 * them. A Locked page's cards come back without description, maker or picture.
 */
async function publicOriginals(profileId: string): Promise<Original[]> {
  const { data, error } = await supabase
    .from('published_items')
    .select('id, name, item_type, description, origin, origin_year, riff_of_id, credit_status, creator_profile_id, origin_bar_profile_id, image_url, image_is_generated')
    .eq('is_reference', false)
    .or(`creator_profile_id.eq.${profileId},origin_bar_profile_id.eq.${profileId}`)
    .order('name')
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as PublicOriginalRow[];
  const makerIds = [...new Set(rows.flatMap((r) => [r.creator_profile_id, r.origin_bar_profile_id]).filter((x): x is string => !!x))];
  const makers = makerIds.length ? await supabase.from('profiles').select(PROFILE_COLUMNS).in('id', makerIds) : { data: [], error: null };
  if (makers.error) throw makers.error;
  const byId = new Map(((makers.data ?? []) as CreditProfile[]).map((p) => [p.id, p]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    item_type: r.item_type,
    description: r.description,
    origin: r.origin,
    origin_year: r.origin_year,
    riff_of_id: r.riff_of_id,
    credit_status: r.credit_status,
    creator: (r.creator_profile_id && byId.get(r.creator_profile_id)) || null,
    origin_bar: (r.origin_bar_profile_id && byId.get(r.origin_bar_profile_id)) || null,
    glass: null,
    item_images: r.image_url ? [{ angle: 'hero', is_generated: r.image_is_generated, images: { url: r.image_url } }] : [],
  }));
}

/**
 * Drinks credited to a profile: made by the person (alone or with others), or
 * first made at the bar. A Locked bar page's drinks are its team's alone in
 * items, so everyone else gets their public cards (names and credits) as well.
 */
export function useProfileOriginals(profileId: string | null | undefined, { locked = false }: { locked?: boolean } = {}) {
  const userId = useUserId();
  const viewer = viewerScoped(userId);
  return useQuery({
    queryKey: ['profile-originals', profileId, viewer.key, locked],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<Original[]> => {
      if (!userId) return publicOriginals(profileId!);
      const [{ data, error }, cards] = await Promise.all([
        supabase
          .from('items')
          .select(ORIGINAL_COLUMNS)
          .or((await creditedTo(profileId!)).join(','))
          .order('name')
          .limit(100),
        locked ? publicOriginals(profileId!) : Promise.resolve([]),
      ]);
      if (error) throw error;
      // ponytail: supabase-js can't type an embed on items' own foreign keys ("more than one relationship"), so the row is cast; hint it as items!<fk> to drop this.
      const rows = (data ?? []) as unknown as Original[];
      const seen = new Set(rows.map((r) => r.id));
      const missing = cards.filter((c) => !seen.has(c.id));
      return missing.length ? [...rows, ...missing].sort((a, b) => a.name.localeCompare(b.name)) : rows;
    },
  });
}

/** Credited drinks by id, for a signed-in viewer (items RLS decides which come back). */
export async function originalsByIds(ids: string[]): Promise<Original[]> {
  const { data, error } = await supabase.from('items').select(ORIGINAL_COLUMNS).in('id', ids).order('name').limit(100);
  if (error) throw error;
  // ponytail: supabase-js can't type an embed on items' own foreign keys ("more than one relationship"), so the row is cast; hint it as items!<fk> to drop this.
  return (data ?? []) as unknown as Original[];
}

/**
 * The drinks I've made: every drink I wrote up here (at a venue or on my
 * own), plus the ones credited to my profile when I have one. My own view;
 * other people see only what's credited (useProfileOriginals).
 */
export function useMyMadeDrinks(profileId: string | null | undefined, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['my-made', userId, profileId ?? null],
    enabled: !!userId && enabled,
    queryFn: async (): Promise<Original[]> => {
      const { data, error } = await supabase
        .from('items')
        .select(ORIGINAL_COLUMNS)
        .eq('item_type', 'cocktail')
        .or([`created_by.eq.${userId}`, ...(profileId ? await creditedTo(profileId) : [])].join(','))
        .order('name')
        .limit(200);
      if (error) throw error;
      // ponytail: supabase-js can't type an embed on items' own foreign keys ("more than one relationship"), so the row is cast; hint it as items!<fk> to drop this.
      return (data ?? []) as unknown as Original[];
    },
  });
}
