import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, XStack, YStack, useTheme } from 'tamagui';

import { SortableImageList } from '@/components/cocktail/SortableImageList';
import { DrinkFormFields, drinkColumns, useDrinkFormState } from '@/components/drink/DrinkFormFields';
import { imageIdFor, pickDrinkPhotos, setItemImages } from '@/components/drink/drinkImages';
import { GenerateImageButton } from '@/components/GenerateImageButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { bareItemId, DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';
import { supabase } from '@/lib/supabase';

export interface EditDrinkProps {
  isInline?: boolean;
  idProp?: string;
  onClose?: () => void;
  onSave?: () => void;
}

/** Edits a published beer or wine. */
export function EditDrinkScreen({ kind: kindName, isInline, idProp, onClose, onSave }: EditDrinkProps & { kind: DrinkKind }) {
  const kind = DRINK_KINDS[kindName];
  const { id: paramId } = useLocalSearchParams<{ id?: string }>();
  const safeId = bareItemId(kind.kind, idProp !== undefined ? idProp : paramId);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { data: item, isLoading } = kind.useItem(safeId);
  const [saving, setSaving] = useState(false);
  const form = useDrinkFormState();
  const { localImages, setLocalImages, selectedCategories } = form;

  useEffect(() => {
    if (!item) return;
    form.setName(item.name || '');
    form.setDescription(item.description || '');
    form.setMaker(item.brand_maker || '');
    form.setAbv(item.abv?.toString() || '');
    form.setPrice(item.price?.toString() || '');
    form.setBarId(item.bar_id || null);
    form.setOverrideVisibility(item.override_visibility_level?.toString() || null);
    form.setOverrideGeneric(item.override_generic_ingredient_level?.toString() || null);
    form.setOverrideSpecific(item.override_specific_brand_level?.toString() || null);
    form.setOverrideMeasurement(item.override_measurement_level?.toString() || null);
    form.setOverridePrep(item.override_prep_level?.toString() || null);
    if (item.item_categories) {
      form.setSelectedCategories(item.item_categories.map((ic: any) => ic.category_id));
    }
    if (item.item_images) {
      const sorted = [...item.item_images].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
      form.setLocalImages(sorted.map((link: any) => ({ id: link.images.id, url: link.images.url, isNew: false })));
    }
    // Fill the form when the item loads; `form` setters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  // New photos stay local until Save.
  const addImages = (uris: string[]) => {
    if (!uris.length) return;
    setLocalImages((prev) => [...prev, ...uris.map((url) => ({ url, isNew: true }))]);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      Alert.alert('Missing Info', 'Name is required.');
      return;
    }

    setSaving(true);
    try {
      const imageIds: string[] = [];
      for (const img of localImages) {
        if (img.isNew) {
          const imageId = await imageIdFor(img.url, `${kind.storageFolder}/${safeId}`);
          if (!imageId) throw new Error('Failed to upload image');
          imageIds.push(imageId);
        } else if (img.id) {
          imageIds.push(img.id);
        }
      }
      await setItemImages(safeId, imageIds, { replace: true });

      const { error } = await supabase.from('items').update(drinkColumns(form)).eq('id', safeId);
      if (error) throw error;

      // Sync tags: remove the unticked ones, add the new ones.
      const { data: existingLinks } = await supabase.from('item_categories').select('category_id').eq('item_id', safeId);
      const existingIds = existingLinks?.map((l) => l.category_id) || [];
      const toDelete = existingIds.filter((cid) => !selectedCategories.includes(cid));
      const toAdd = selectedCategories.filter((cid) => !existingIds.includes(cid));
      if (toDelete.length > 0) {
        await supabase.from('item_categories').delete().eq('item_id', safeId).in('category_id', toDelete);
      }
      for (const catId of toAdd) {
        await supabase
          .from('item_categories')
          .upsert({ item_id: safeId, category_id: catId, is_primary: true }, { onConflict: 'item_id,category_id' });
      }

      await queryClient.invalidateQueries({ queryKey: [kind.kind, safeId] });
      await queryClient.invalidateQueries({ queryKey: [kind.listQueryKey] });

      Alert.alert('Success', `${kind.label} updated!`, [
        {
          text: 'OK',
          onPress: () => {
            if (isInline) onSave?.();
            else router.back();
          },
        },
      ]);
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', `Failed to update ${kind.label.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={theme.color8?.get() as string} />
      </YStack>
    );
  }

  return (
    <BottomSheetModalProvider>
      <YStack style={styles.container} backgroundColor="$background">
        {!isInline && <Stack.Screen options={{ headerShown: false }} />}

        <XStack
          paddingTop={isInline ? 10 : Platform.OS === 'ios' ? 20 : insets.top + 20}
          paddingHorizontal="$4"
          paddingBottom="$4"
          alignItems="center"
          justifyContent="space-between"
          zIndex={10}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => (isInline ? onClose?.() : router.back())}
            style={styles.headerBtn}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
          </TouchableOpacity>
          <Text fontSize="$5" fontWeight="bold">
            Edit {kind.label}
          </Text>
          <Button onPress={handleSave} disabled={saving} size="$3" chromeless>
            {saving ? (
              <ActivityIndicator size="small" color={theme.color8?.get() as string} />
            ) : (
              <Text color="$color8" fontWeight="bold">
                Save
              </Text>
            )}
          </Button>
        </XStack>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          <SortableImageList
            images={localImages}
            onReorder={setLocalImages}
            onRemove={(index) => setLocalImages(localImages.filter((_, i) => i !== index))}
            onAdd={async () => addImages(await pickDrinkPhotos())}
            onAddUris={addImages}
            generateComponent={<GenerateImageButton type={kind.kind} id={safeId} variant="tile" />}
          />
          <DrinkFormFields kind={kind} form={form} />
        </ScrollView>
      </YStack>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
});
