import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { uploadDrinkPhoto } from '@/components/drink/drinkImages';
import { useUserId } from '@/ctx/AuthContext';
import { withPublishedItems } from '@/hooks/useRankings';
import { track } from '@/lib/analytics';
import type { ItemImageLink } from '@/lib/itemImages';
import { heroPicture } from '@/lib/itemImages';
import type { Compared, Swap } from '@/lib/madeIt';
import { supabase } from '@/lib/supabase';

/** One time someone made a drink at home. Plain JSON (the query cache is persisted). */
export interface MadeDrink {
  id: string;
  itemId: string;
  name: string;
  /** Your photo of it, else the drink's own picture. */
  imageUrl: string | null;
  madeOn: string;
  compared: Compared | null;
  swaps: Swap[];
  note: string | null;
  rankEntryId: string | null;
  /** A catalog classic, not a bar's drink. */
  classic: boolean;
}

interface MadeRow {
  id: string;
  item_id: string;
  made_on: string;
  compared: Compared | null;
  swaps: Swap[];
  note: string | null;
  rank_entry_id: string | null;
  photo: { url: string } | null;
  item: { name: string; is_catalog?: boolean | null; item_images: ItemImageLink[] | null } | null;
}

const madeKey = (userId: string | null) => ['made', userId] as const;

/** Everything you've made at home, latest first. Private to you (made_drinks). */
export function useMadeDrinks() {
  const userId = useUserId();
  return useQuery({
    queryKey: madeKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<MadeDrink[]> => {
      // ponytail: one page. People log dozens of nights in, not thousands; page by made_on past that.
      const { data, error } = await supabase
        .from('made_drinks')
        .select('id, item_id, made_on, compared, swaps, note, rank_entry_id, photo:images!image_id(url), item:items!item_id(name, is_catalog, item_images(angle, sort_order, is_generated, images(url)))')
        .order('made_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      // A bar's drink a guest can't read in items still has its published name.
      const rows = await withPublishedItems((data ?? []) as unknown as MadeRow[]);
      return rows.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        name: r.item?.name ?? 'A drink',
        imageUrl: r.photo?.url ?? heroPicture(r.item?.item_images)?.url ?? null,
        madeOn: r.made_on,
        compared: r.compared,
        swaps: r.swaps ?? [],
        note: r.note,
        rankEntryId: r.rank_entry_id,
        classic: !!r.item?.is_catalog,
      }));
    },
  });
}

export interface NewMade {
  item_id: string;
  made_on: string;
  compared: Compared | null;
  swaps: Swap[];
  note: string | null;
  rank_entry_id: string | null;
  /** "Show on my profile". */
  on_profile: boolean;
  /** A photo picked on this device, uploaded to the drinks bucket first. */
  photoUri: string | null;
}

/** Log a drink made at home, with its photo when there is one. */
export function useLogMade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ photoUri, ...made }: NewMade) => {
      // The bucket refuses uploads past the day's limit (has_upload_room), which lands here too.
      const image = photoUri ? await uploadDrinkPhoto(photoUri, `cocktails/${made.item_id}/made`).catch(() => null) : null;
      if (photoUri && !image) throw new Error('the photo didn’t upload. Check your connection, or try again tomorrow if you’ve added a lot of photos today.');
      const { error } = await supabase.from('made_drinks').insert({ ...made, image_id: image?.id ?? null });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, made) => track('drink_made', { compared: made.compared ?? 'none', swaps: made.swaps.length, photo: !!made.photoUri, shown: made.on_profile }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['made'] });
      void qc.invalidateQueries({ queryKey: ['profile-made'] });
    },
    onError: () => {},
  });
}

/** One drink someone made at home and shows on their profile (get_profile_made). Plain JSON. */
export interface SharedMade {
  id: string;
  itemId: string;
  name: string;
  /** Their photo of it, else the drink's own picture. */
  imageUrl: string | null;
  isSketch: boolean;
  /** Null when they don't say when they had their drinks. */
  madeOn: string | null;
  note: string | null;
}

interface SharedMadeRow {
  id: string;
  item_id: string;
  name: string;
  image_url: string | null;
  image_is_generated: boolean | null;
  photo_url: string | null;
  made_on: string | null;
  note: string | null;
}

/**
 * The drinks someone made at home and chose to show, latest first, for the
 * Had list on their profile. The server leaves out a private profile, one
 * showing no drinks had, and anyone on either side of a block. (It answers
 * signed out too, but person pages are behind sign-in.)
 */
export function useProfileMade(profileId: string | null | undefined, enabled: boolean) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['profile-made', profileId, userId],
    enabled: enabled && !!profileId,
    queryFn: async (): Promise<SharedMade[]> => {
      const { data, error } = await supabase.rpc('get_profile_made', { p_profile_id: profileId! });
      if (error) throw error;
      return ((data ?? []) as SharedMadeRow[]).map((r) => ({
        id: r.id,
        itemId: r.item_id,
        name: r.name,
        imageUrl: r.photo_url ?? r.image_url,
        isSketch: !r.photo_url && !!r.image_is_generated,
        madeOn: r.made_on,
        note: r.note,
      }));
    },
  });
}

/** Shows or hides one of your made drinks on your profile. */
export function useSetMadeShown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, shown }: { id: string; shown: boolean }) => {
      const { error } = await supabase.from('made_drinks').update({ on_profile: shown }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['made'] });
      void qc.invalidateQueries({ queryKey: ['profile-made'] });
    },
    onError: () => {},
  });
}
