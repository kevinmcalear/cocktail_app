import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { newDraftId } from '@/lib/drinkWizard';
import { readSketchInputs, type SketchInputs } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';

// Draw my glass (supabase/migrations/20261118300000_draw_my_glass.sql): the
// photo a venue's or a home's own glass was traced from, kept private in the
// glass-photos bucket (Open decisions d57), and sharing it with the catalog
// (d56, d58), which the Cocktail team checks first.

const BUCKET = 'glass-photos';

/** Where a glass's photo goes: under the venue's page, or the person's own folder at home. */
export const photoFolder = (where: { pageId: string } | { userId: string }) => ('pageId' in where ? `bar/${where.pageId}` : `home/${where.userId}`);

/** Keeps a photo (a JPEG) in the folder; returns its path. */
export async function uploadGlassPhoto(folder: string, jpeg: ArrayBuffer): Promise<string> {
  const path = `${folder}/${newDraftId()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Takes a photo out of the bucket. A file left behind is only clutter, so a failure is let go. */
export async function removeGlassPhoto(path: string | null | undefined) {
  if (path)
    await supabase.storage
      .from(BUCKET)
      .remove([path])
      .catch(() => {});
}

/** A short-lived link to a kept photo, for its venue's staff or its owner. */
export function useGlassPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['glass-photo', path],
    enabled: !!path,
    // The link lasts an hour; it's fetched again before then. (Not a persisted key: lib/queryCachePersist.ts.)
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Delete photo: the glass lets go of it first, so it never points at nothing. */
export function useDeleteGlassPhoto(table: 'bar_glassware' | 'home_glassware', invalidate: readonly unknown[]) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      const { error } = await supabase.from(table).update({ photo_path: null }).eq('id', id);
      if (error) throw error;
      await removeGlassPhoto(path);
    },
    onSettled: () => client.invalidateQueries({ queryKey: invalidate }),
  });
}

export interface GlassShare {
  id: string;
  status: 'in_review' | 'added' | 'declined';
  created_at: string;
  note: string | null;
}

type ShareOf = { bar_glass_id: string } | { home_glass_id: string };
const shareKey = (of: ShareOf) => ['glass-share', of] as const;

/** Whether the glass is shared, and where its review is. Null when it isn't. */
export function useGlassShare(of: ShareOf | null) {
  return useQuery({
    queryKey: shareKey(of ?? { bar_glass_id: '' }),
    enabled: !!of,
    queryFn: async (): Promise<GlassShare | null> => {
      const [col, id] = Object.entries(of!)[0];
      const { data, error } = await supabase.from('glass_shares').select('id, status, created_at, note').eq(col, id).maybeSingle();
      if (error) throw error;
      return data as GlassShare | null;
    },
  });
}

/** Share it (in review; a declined share is replaced), or Stop sharing while it's in review. */
export function useSetGlassShared(of: ShareOf) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (shared: boolean) => {
      const [col, id] = Object.entries(of)[0];
      const { error: cleared } = await supabase
        .from('glass_shares')
        .delete()
        .eq(col, id)
        .eq('status', shared ? 'declined' : 'in_review');
      if (cleared) throw cleared;
      if (!shared) return;
      const { error } = await supabase.from('glass_shares').insert(of as { bar_glass_id?: string; home_glass_id?: string });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: shareKey(of) }),
  });
}

/** The venue's drinks drawn in a glass of this type (it's the main one): how many, and the first few's drawings. */
export function useDrinksDrawnIn(barId: string | null | undefined, glass: string, enabled: boolean) {
  return useQuery({
    queryKey: ['drinks-drawn-in', barId, glass],
    enabled: !!barId && enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ count: number; first: { id: string; inputs: SketchInputs }[] }> => {
      const { data, count, error } = await supabase
        .from('item_sketches')
        .select('item_id, inputs, items!inner(bar_id)', { count: 'exact' })
        .eq('items.bar_id', barId!)
        .eq('inputs->>glass', glass)
        .limit(2);
      if (error) throw error;
      const first = (data ?? []).flatMap((r) => {
        const inputs = readSketchInputs(r.inputs);
        return inputs ? [{ id: r.item_id as string, inputs }] : [];
      });
      return { count: count ?? first.length, first };
    },
  });
}
