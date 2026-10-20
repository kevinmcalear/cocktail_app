import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { pickDrinkPhotos, setItemImages, uploadDrinkPhoto } from '@/components/drink/drinkImages';
import { useDrafts } from '@/hooks/useDrafts';
import { beerWineColumns, beerWineImageIds, EMPTY_BEER_WINE_FIELDS, useBeerWineFields, type BeerWineFields } from '@/hooks/useBeerWineEditor';
import { recentEntry, useTrackRecent } from '@/hooks/useTrackRecent';
import { confirmAsync } from '@/lib/dialogs';
import { updateMenuDraftsWithPublishedId } from '@/lib/drafts';
import { DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';
import { capitalize } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';
import { toastDone } from '@/lib/toast';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const strOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null);

/**
 * A beer or wine draft saved by the older editor (New > Drafts), for the edit
 * page: Save draft keeps it a draft, Publish makes it a beer or wine. Photos
 * upload as they're added, so a draft keeps them online.
 */
export function useBeerWineDraftEditor({ kind: kindName, draftId, barId: barParam, initialName }: { kind: DrinkKind; draftId: string; barId?: string | null; initialName?: string | null }) {
  const kind = DRINK_KINDS[kindName];
  const queryClient = useQueryClient();
  const { drafts, saveDraft, deleteDraft, isFetching, loaded: draftsLoaded, failed } = useDrafts();
  const form = useBeerWineFields({ ...EMPTY_BEER_WINE_FIELDS, name: initialName ? capitalize(initialName) : '', barId: barParam || null });
  const [saving, setSaving] = useState(false);
  const draft = drafts.find((d) => d.id === draftId);

  useTrackRecent(
    !!draft,
    draft ? recentEntry(kind.kind, draft.id, form.name || `Untitled ${kind.label}`, { isDraft: true, imageUrl: form.localImages[0]?.url, barId: draft.bar_id ?? form.barId ?? null }) : null
  );

  // Fill the form once the draft has loaded.
  const [loaded, setLoaded] = useState(false);
  if (!loaded && !isFetching && draft?.draft_data) {
    setLoaded(true);
    const d = draft.draft_data as Record<string, unknown>;
    form.reset({
      name: str(d.name),
      description: str(d.description),
      // The maker's key predates sharing this screen, so it stays per kind.
      maker: str(d[kind.maker.draftKey]),
      abv: str(d.abv),
      price: str(d.price),
      selectedCategories: Array.isArray(d.selectedCategories) ? (d.selectedCategories as string[]) : [],
      localImages: Array.isArray(d.localImages) ? (d.localImages as BeerWineFields['localImages']) : [],
      barId: strOrNull(d.barId) ?? barParam ?? null,
      overrideVisibility: strOrNull(d.overrideVisibility),
      overrideGeneric: strOrNull(d.overrideGeneric),
      overrideSpecific: strOrNull(d.overrideSpecific),
      overrideMeasurement: strOrNull(d.overrideMeasurement),
      overridePrep: strOrNull(d.overridePrep),
    });
  }

  const { maker, ...rest } = form.fields;
  const draftData = { ...rest, [kind.maker.draftKey]: maker };

  // Saved as you go (as a cocktail's draft is), so closing or swiping the page away loses nothing.
  const pending = loaded && form.isDirty ? JSON.stringify(draftData) : null;
  const { markClean } = form;
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      saveDraft({ id: draftId, entityType: kind.kind, draftData: JSON.parse(pending) }).then(markClean, (e) => console.error('Draft autosave failed', e));
    }, 1500);
    return () => clearTimeout(timer);
  }, [pending, draftId, kind.kind, saveDraft, markClean]);

  const handleSaveDraft = async (): Promise<boolean> => {
    setSaving(true);
    try {
      await saveDraft({ id: draftId, entityType: kind.kind, draftData });
      form.markClean();
      toastDone('Draft saved', 'You can finish it later from Drafts.');
      return true;
    } catch (error) {
      console.error('Draft error:', error);
      Alert.alert('Error', 'Failed to save draft.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Drafts keep their photos online, so they survive closing the app.
  const addImages = async (uris: string[]) => {
    if (!uris.length) return;
    setSaving(true);
    try {
      const uploaded: BeerWineFields['localImages'] = [];
      for (const uri of uris) {
        const image = await uploadDrinkPhoto(uri, 'drafts');
        if (image) uploaded.push({ ...image, isNew: false });
      }
      form.setLocalImages((prev) => [...prev, ...uploaded]);
    } catch (error) {
      console.error('Error uploading drafted image', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (): Promise<boolean> => {
    const f = form.fields;
    if (!f.name.trim()) {
      Alert.alert('Missing Info', 'Name is required.');
      return false;
    }
    const ok = await confirmAsync({ title: `Publish ${kind.label}`, message: `Are you sure you want to publish this ${kind.label.toLowerCase()}?`, confirmText: 'Publish' });
    if (!ok) return false;
    setSaving(true);
    try {
      const { data: created, error: insertError } = await supabase
        .from('items')
        .insert({ item_type: kind.kind, ...beerWineColumns(f) })
        .select()
        .single();
      if (insertError || !created) throw insertError;
      const newId: string = created.id;
      await setItemImages(newId, await beerWineImageIds(f.localImages, `${kind.storageFolder}/${newId}`), { replace: false });
      for (const catId of f.selectedCategories) {
        await supabase.from('item_categories').upsert({ item_id: newId, category_id: catId, is_primary: true }, { onConflict: 'item_id,category_id' });
      }
      void queryClient.invalidateQueries({ queryKey: [kind.listQueryKey] });
      await updateMenuDraftsWithPublishedId(`${kind.kind}-${draftId}`, `${kind.kind}-${newId}`, drafts, saveDraft);
      await deleteDraft(draftId);
      if (f.barId) void queryClient.invalidateQueries({ queryKey: ['bar', f.barId] });
      form.markClean();
      toastDone(`${kind.label} created`, capitalize(f.name));
      return true;
    } catch (error) {
      console.error('Creation error:', error);
      Alert.alert('Error', (error as { message?: string } | null)?.message || `Failed to create ${kind.label.toLowerCase()}.`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<boolean> => {
    const ok = await confirmAsync({ title: 'Delete this draft?', message: "It can't be undone.", confirmText: 'Delete', destructive: true });
    if (!ok) return false;
    await deleteDraft(draftId);
    return true;
  };

  return {
    ...form,
    kind: kindName,
    draftId,
    isLoading: !loaded && (isFetching || !draftsLoaded),
    failed: loaded ? null : failed,
    /** Filled from the draft (or there's none to fill from): undo starts here. */
    ready: loaded || (draftsLoaded && !isFetching && !draft),
    saving,
    addImages,
    pickImage: async () => addImages(await pickDrinkPhotos()),
    handleSaveDraft,
    handlePublish,
    handleDelete,
  };
}
