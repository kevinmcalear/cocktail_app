import { keepPreviousData, useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { imageIdFor, setItemImages } from '@/components/drink/drinkImages';
import { pickerResult, usePickerTerm } from '@/hooks/useDiscover';
import { recentEntry } from '@/hooks/useTrackRecent';
import { track } from '@/lib/analytics';
import { beerWinePlace, type BeerWineDraft } from '@/lib/beerWineDraft';
import { beerWineSketch, fullDescription, type CatalogBottle } from '@/lib/beerWineWizard';
import { plainDbMessage } from '@/lib/dbError';
import { DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';
import { likeExactly } from '@/lib/drinkWizard';
import { formatPrice } from '@/lib/menus';
import { nameKey } from '@/lib/sameName';
import { capitalizeFirsts } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';
import { toastDone } from '@/lib/toast';
import { useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

export interface CreateBeerWineInput {
  kind: DrinkKind;
  draft: BeerWineDraft;
  /** The venue it's added at; null for one at home. */
  barId: string | null;
  /** Saved with no signal (Save on this phone): it waits for signal, and says so when it's in, wherever you are by then. */
  queued?: boolean;
}

const number = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * Saves the beer or wine wizard's draft in one go: the item, the glass it's
 * drawn in (drink_glass), its style and region (as categories, when the
 * catalog has them), then its photo. The glass, photo and categories are
 * extras: if they don't stick the item is still saved, and the caller hears
 * what didn't.
 */
const CREATE_BEER_WINE = ['create-beer-wine'];

/** A save from this place still waiting for signal: saving it again would add it twice. */
export function useBeerWineWaiting(place: string) {
  return useMutationState({
    filters: { mutationKey: CREATE_BEER_WINE, status: 'pending' },
    select: (m) => {
      const v = m.state.variables as CreateBeerWineInput | undefined;
      return v ? beerWinePlace(v.kind, v.barId) : null;
    },
  }).includes(place);
}

export function useCreateBeerWine() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CREATE_BEER_WINE,
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
          price: barId ? formatPrice(draft.price) : null,
          description: fullDescription(draft) || null,
          origin: draft.origin,
          bar_id: barId,
        })
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error(`Couldn’t save the ${config.label.toLowerCase()}.`);
      const id = data.id as string;

      const variant = beerWineSketch(kind, draft).variant;
      if (variant) {
        const { error: glassError } = await supabase.from('drink_glass').insert({ item_id: id, sketch_variant: variant });
        if (glassError) warnings.push(plainDbMessage(glassError) ?? 'Its glass didn’t save, so it’s drawn in the usual one.');
      }

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
      // So a second save of this name sees it taken at once, not after the name check's 30 s.
      void qc.invalidateQueries({ queryKey: ['same-name-drink'] });
      if (barId) void qc.invalidateQueries({ queryKey: ['bar', barId] });
      return { id, warnings };
    },
    onSuccess: ({ warnings }, { kind, draft, barId, queued }) => {
      track('drink_created', { at_bar: !!barId, on_menu: false });
      // Here, not on the screen: a save that waited for signal lands after the wizard has closed.
      // ponytail: a wait cut short by closing the app loses the save, not the draft, which Add still lists; register it with setMutationDefaults to resume it after a relaunch.
      // Only the draft that was saved: one started since in the same place stays.
      const store = useBeerWineWizardStore.getState();
      const place = beerWinePlace(kind, barId);
      if (nameKey(store.kept[place]?.draft.name ?? '') === nameKey(draft.name)) store.clear(place);
      if (!queued) return;
      toastDone(`${DRINK_KINDS[kind].label} saved`, capitalizeFirsts(draft.name));
      if (warnings.length) Alert.alert('Saved, with one thing to fix', warnings.join('\n\n'));
    },
    // The wizard says what went wrong itself and keeps the draft; a save that waited for signal lands after it closed, so that one is said here.
    onError: (e, { kind, draft, queued }) => {
      if (queued) Alert.alert(`Couldn’t save ${capitalizeFirsts(draft.name) || `the ${kind}`}`, `${plainDbMessage(e) ?? e.message} It’s still in Add, under Pick up where you left off.`);
    },
  });
}

/**
 * Shared beers or wines whose name has what's typed in it, to start from:
 * "Punk" finds BrewDog Punk IPA with its brewery, strength and style.
 */
export function useCatalogBottles(kind: DrinkKind, name: string) {
  const { term: q, waiting } = usePickerTerm(name.trim(), 3);
  const query = useQuery({
    queryKey: ['catalog-bottles', kind, q.toLowerCase()],
    enabled: !!q,
    placeholderData: q ? keepPreviousData : undefined,
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
      return (data ?? []).map(({ item_categories, ...r }) => ({
        ...r,
        abv: r.abv === null ? null : Number(r.abv),
        categories: (item_categories ?? []).map((c) => c.categories?.name).filter((n): n is string => !!n),
      }));
    },
  });
  return pickerResult(query, waiting);
}
