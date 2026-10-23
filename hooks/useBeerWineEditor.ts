import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';

import type { ImageItem } from '@/components/cocktail/SortableImageList';
import { imageIdFor, pickDrinkPhotos, setItemImages } from '@/components/drink/drinkImages';
import { plainDbMessage } from '@/lib/dbError';
import { DRINK_KINDS, type DrinkKind, type DrinkKindConfig } from '@/lib/drinkKinds';
import { numericPrice } from '@/lib/menus';
import { capitalize } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';
import { toastDone } from '@/lib/toast';

/** Everything the beer and wine editor edits. */
export interface BeerWineFields {
  name: string;
  description: string;
  maker: string;
  abv: string;
  price: string;
  /** Style and region, as tags (item_categories). */
  selectedCategories: string[];
  localImages: ImageItem[];
  barId: string | null;
  overrideVisibility: string | null;
  overrideGeneric: string | null;
  overrideSpecific: string | null;
  overrideMeasurement: string | null;
  overridePrep: string | null;
}

export const EMPTY_BEER_WINE_FIELDS: BeerWineFields = {
  name: '',
  description: '',
  maker: '',
  abv: '',
  price: '',
  selectedCategories: [],
  localImages: [],
  barId: null,
  overrideVisibility: null,
  overrideGeneric: null,
  overrideSpecific: null,
  overrideMeasurement: null,
  overridePrep: null,
};

type Update<T> = T | ((prev: T) => T);

/** The fields, a setter for each (the names the drink editor's shared sheets expect), and whether they changed since `reset`. */
export function useBeerWineFields(initial: BeerWineFields) {
  const [fields, setFields] = useState(initial);
  const [clean, setClean] = useState(() => JSON.stringify(initial));
  const set = (patch: Partial<BeerWineFields>) => setFields((f) => ({ ...f, ...patch }));
  const field =
    <K extends keyof BeerWineFields>(key: K) =>
    (v: Update<BeerWineFields[K]>) =>
      setFields((f) => ({ ...f, [key]: typeof v === 'function' ? (v as (p: BeerWineFields[K]) => BeerWineFields[K])(f[key]) : v }));
  return {
    ...fields,
    fields,
    set,
    isDirty: JSON.stringify(fields) !== clean,
    reset: (next: BeerWineFields) => {
      setFields(next);
      setClean(JSON.stringify(next));
    },
    markClean: () => setClean(JSON.stringify(fields)),
    setName: field('name'),
    setDescription: field('description'),
    setMaker: field('maker'),
    setAbv: field('abv'),
    setPrice: field('price'),
    setLocalImages: field('localImages'),
    setBarId: field('barId'),
    setOverrideVisibility: field('overrideVisibility'),
    setOverrideGeneric: field('overrideGeneric'),
    setOverrideSpecific: field('overrideSpecific'),
    setOverrideMeasurement: field('overrideMeasurement'),
    setOverridePrep: field('overridePrep'),
    toggleCategory: (id: string) => setFields((f) => ({ ...f, selectedCategories: f.selectedCategories.includes(id) ? f.selectedCategories.filter((c) => c !== id) : [...f.selectedCategories, id] })),
  };
}

export type BeerWineForm = ReturnType<typeof useBeerWineFields>;

/** The item's columns, from the form (shared by publishing a draft and saving an edit). */
export function beerWineColumns(f: BeerWineFields) {
  const level = (value: string | null) => (value ? parseInt(value, 10) : null);
  return {
    name: capitalize(f.name),
    description: f.description,
    brand_maker: capitalize(f.maker) || null,
    abv: f.abv ? parseFloat(f.abv) : null,
    price: f.price ? numericPrice(parseFloat(f.price)) : null,
    bar_id: f.barId || null,
    override_visibility_level: level(f.overrideVisibility),
    override_generic_ingredient_level: level(f.overrideGeneric),
    override_specific_brand_level: level(f.overrideSpecific),
    override_measurement_level: level(f.overrideMeasurement),
    override_prep_level: level(f.overridePrep),
  };
}

/** Uploads the new photos into `folder` and returns every photo's image id, in order. */
export async function beerWineImageIds(images: ImageItem[], folder: string): Promise<string[]> {
  const ids: string[] = [];
  for (const img of images) {
    if (img.isNew) {
      const imageId = await imageIdFor(img.url, folder);
      if (!imageId) throw new Error('Failed to upload image');
      ids.push(imageId);
    } else if (img.id) {
      ids.push(img.id);
    }
  }
  return ids;
}

type Item = NonNullable<ReturnType<DrinkKindConfig['useItem']>['data']>;

const text = (v: unknown) => (v == null ? '' : String(v));

function fieldsOf(item: Item): BeerWineFields {
  const links = (item.item_images ?? []) as { sort_order: number | null; images: { id: string; url: string } | null }[];
  return {
    name: text(item.name),
    description: text(item.description),
    maker: text(item.brand_maker),
    abv: text(item.abv),
    price: text(item.price),
    selectedCategories: ((item.item_categories ?? []) as { category_id: string }[]).map((ic) => ic.category_id),
    localImages: [...links]
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .flatMap((l) => (l.images ? [{ id: l.images.id, url: l.images.url, isNew: false }] : [])),
    barId: item.bar_id ?? null,
    // ponytail: app_item_presentation has no override_* columns, so these
    // have always loaded empty (and Save writes them back as null). Reading
    // them from items is its own fix; this keeps today's behaviour.
    overrideVisibility: null,
    overrideGeneric: null,
    overrideSpecific: null,
    overrideMeasurement: null,
    overridePrep: null,
  };
}

/** Editing a saved beer or wine: the form, filled once it loads, and Save. */
export function useBeerWineEditor(kindName: DrinkKind, id: string) {
  const kind = DRINK_KINDS[kindName];
  const queryClient = useQueryClient();
  const { data: item, isLoading } = kind.useItem(id);
  const form = useBeerWineFields(EMPTY_BEER_WINE_FIELDS);
  const [saving, setSaving] = useState(false);
  // Filled once: a refetch while editing mustn't throw away what's typed.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (item && loadedId !== item.id) {
    setLoadedId(item.id);
    form.reset(fieldsOf(item));
  }

  // New photos stay local until Save.
  const addImages = (uris: string[]) => {
    if (uris.length) form.setLocalImages((prev) => [...prev, ...uris.map((url) => ({ url, isNew: true }))]);
  };

  const handleSave = async (): Promise<boolean> => {
    const f = form.fields;
    if (!f.name.trim()) {
      Alert.alert('Missing Info', 'Name is required.');
      return false;
    }
    setSaving(true);
    try {
      await setItemImages(id, await beerWineImageIds(f.localImages, `${kind.storageFolder}/${id}`), { replace: true });
      const { error } = await supabase.from('items').update(beerWineColumns(f)).eq('id', id);
      if (error) throw error;

      // Sync tags: remove the unticked ones, add the new ones.
      const { data: existingLinks } = await supabase.from('item_categories').select('category_id').eq('item_id', id);
      const existingIds = existingLinks?.map((l) => l.category_id) || [];
      const toDelete = existingIds.filter((cid) => !f.selectedCategories.includes(cid));
      const toAdd = f.selectedCategories.filter((cid) => !existingIds.includes(cid));
      if (toDelete.length > 0) await supabase.from('item_categories').delete().eq('item_id', id).in('category_id', toDelete);
      for (const catId of toAdd) {
        await supabase.from('item_categories').upsert({ item_id: id, category_id: catId, is_primary: true }, { onConflict: 'item_id,category_id' });
      }

      await queryClient.invalidateQueries({ queryKey: [kind.kind, id] });
      await queryClient.invalidateQueries({ queryKey: [kind.listQueryKey] });
      form.markClean();
      toastDone(`${kind.label} saved`, capitalize(f.name));
      return true;
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', plainDbMessage(error) ?? `Failed to update ${kind.label.toLowerCase()}.`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    ...form,
    kind: kindName,
    id,
    item,
    isLoading,
    /** Filled from the saved one: undo starts here. */
    ready: !!item && loadedId === item.id,
    saving,
    addImages,
    pickImage: async () => addImages(await pickDrinkPhotos()),
    handleSave,
  };
}
