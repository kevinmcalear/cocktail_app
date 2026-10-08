import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { imageIdFor, setItemImages } from '@/components/drink/drinkImages';
import { recentEntry } from '@/hooks/useTrackRecent';
import { track } from '@/lib/analytics';
import { beerWineSketch, fullDescription, type BeerWineDraft, type CatalogBottle } from '@/lib/beerWineWizard';
import { plainDbMessage } from '@/lib/dbError';
import { DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';
import { likeExactly } from '@/lib/drinkWizard';
import { capitalizeFirsts } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

export interface CreateBeerWineInput {
  kind: DrinkKind;
  draft: BeerWineDraft;
  /** The venue it's added at; null for one at home. */
  barId: string | null;
}

const number = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * Saves the beer or wine wizard's draft in one go: the item, its style and
 * region (as categories, when the catalog has them), then its photo. The
 * photo and categories are extras: if they don't stick the item is still
 * saved, and the caller hears what didn't.
 */
export function useCreateBeerWine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, draft, barId }: CreateBeerWineInput): Promise<{ id: string; warnings: string[] }> => {
      const config = DRINK_KINDS[kind];
      const warnings: string[] = [];
      const { data, error } = await supabase
        .from('items')
        .insert({
          item_type: kind,
          name: capitalizeFirsts(draft.name),
          brand_maker: capitalizeFirsts(draft.maker) || null,
          abv: number(draft.abv),
          price: barId ? number(draft.price) : null,
          description: fullDescription(draft) || null,
          origin: draft.origin,
          bar_id: barId,
          sketch_variant: beerWineSketch(kind, draft).variant,
        })
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error(`Couldn’t save the ${config.label.toLowerCase()}.`);
      const id = data.id as string;

      const names = [draft.style, draft.region].filter((n): n is string => !!n);
      if (names.length) {
        const { data: cats } = await supabase.from('categories').select('id, name').eq('domain', kind).in('name', names);
        if (cats?.length) {
          const { error: catError } = await supabase
            .from('item_categories')
            .upsert(cats.map((c) => ({ item_id: id, category_id: c.id, is_primary: c.name === draft.style })), { onConflict: 'item_id,category_id' });
          if (catError) warnings.push(plainDbMessage(catError) ?? 'Its style didn’t save. Add it on its page.');
        }
      }

      if (draft.photo) {
        const imageId = await imageIdFor(draft.photo.uri, `${config.storageFolder}/${id}`);
        if (imageId) await setItemImages(id, [imageId], { replace: false });
        else warnings.push('The photo didn’t upload. Add it again on its page.');
      }

      useRecentActivityStore.getState().push(recentEntry(kind, id, capitalizeFirsts(draft.name), { barId }));
      void qc.invalidateQueries({ queryKey: [config.listQueryKey] });
      if (barId) void qc.invalidateQueries({ queryKey: ['bar', barId] });
      return { id, warnings };
    },
    onSuccess: (_, { barId }) => track('drink_created', { at_bar: !!barId, on_menu: false }),
    // The wizard says what went wrong itself, and keeps the draft.
    onError: () => {},
  });
}

/**
 * Shared beers or wines whose name has what's typed in it, to start from:
 * "Punk" finds BrewDog Punk IPA with its brewery, strength and style.
 */
export function useCatalogBottles(kind: DrinkKind, name: string) {
  const q = name.trim();
  return useQuery({
    queryKey: ['catalog-bottles', kind, q.toLowerCase()],
    enabled: q.length >= 3,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<CatalogBottle[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, brand_maker, abv, description, origin, item_categories ( categories ( name ) )')
        .eq('item_type', kind)
        .is('bar_id', null)
        .ilike('name', `%${likeExactly(q)}%`)
        .order('name')
        .limit(4);
      if (error) throw error;
      type Row = Omit<CatalogBottle, 'categories'> & { item_categories: { categories: { name: string } | null }[] | null };
      return ((data ?? []) as unknown as Row[]).map(({ item_categories, ...r }) => ({
        ...r,
        abv: r.abv === null ? null : Number(r.abv),
        categories: (item_categories ?? []).map((c) => c.categories?.name).filter((n): n is string => !!n),
      }));
    },
  });
}
