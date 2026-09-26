import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter, usePreventRemove } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, View, XStack, YStack, useTheme } from 'tamagui';

import { SortableImageList } from '@/components/cocktail/SortableImageList';
import { DrinkFormFields, drinkColumns, useDrinkFormState } from '@/components/drink/DrinkFormFields';
import { imageIdFor, pickDrinkPhotos, setItemImages, uploadDrinkPhoto } from '@/components/drink/drinkImages';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useDrafts } from '@/hooks/useDrafts';
import { recentEntry, useTrackRecent } from '@/hooks/useTrackRecent';
import { confirmAsync, showMessage } from '@/lib/dialogs';
import { DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';
import { updateMenuDraftsWithPublishedId } from '@/lib/drafts';
import { capitalize } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';

export interface AddDrinkProps {
  isInline?: boolean;
  draftIdProp?: string;
  barIdProp?: string;
  initialNameProp?: string;
  onClose?: () => void;
  onSave?: () => void;
}

/** Creates a beer or wine, as a draft first if the user saves before publishing. */
export function AddDrinkScreen({
  kind: kindName,
  isInline,
  draftIdProp,
  barIdProp,
  initialNameProp,
  onClose,
  onSave,
}: AddDrinkProps & { kind: DrinkKind }) {
  const kind = DRINK_KINDS[kindName];
  const router = useRouter();
  const { barId: initialBarId, draftId, name: initialNameParam } = useLocalSearchParams<{
    barId?: string;
    draftId?: string;
    name?: string;
  }>();
  const activeDraftIdProp = draftIdProp !== undefined ? draftIdProp : draftId;
  const activeBarIdProp = barIdProp !== undefined ? barIdProp : initialBarId;
  const seedName = initialNameProp !== undefined ? initialNameProp : initialNameParam;
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { drafts, saveDraft, deleteDraft, isFetching } = useDrafts();
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(activeDraftIdProp || null);

  const [showExitModal, setShowExitModal] = useState(false);
  const pendingExitRef = React.useRef<(() => void) | null>(null);
  const [exiting, setExiting] = React.useState(false);

  const form = useDrinkFormState(seedName ? capitalize(seedName) : '', activeBarIdProp || null);
  const { name, localImages, setLocalImages, selectedCategories, barId } = form;

  // What a draft stores. The maker's key predates sharing this screen, so it stays per kind.
  const draftData = {
    name,
    description: form.description,
    [kind.maker.draftKey]: form.maker,
    abv: form.abv,
    price: form.price,
    selectedCategories,
    localImages,
    barId,
    overrideVisibility: form.overrideVisibility,
    overrideGeneric: form.overrideGeneric,
    overrideSpecific: form.overrideSpecific,
    overrideMeasurement: form.overrideMeasurement,
    overridePrep: form.overridePrep,
  };

  const draftLoadedRef = React.useRef<string | null>(null);
  const currentStateStr = JSON.stringify(draftData);
  const [cleanStateStr, setCleanStateStr] = React.useState(currentStateStr);
  const [needsCleanMark, setNeedsCleanMark] = useState(false);
  const hasProgress = () => name.trim() !== '' || currentDraftId !== null || currentStateStr !== cleanStateStr;

  const trackedDraft = currentDraftId ? drafts.find((d: any) => d.id === currentDraftId) : null;
  useTrackRecent(
    !!trackedDraft,
    trackedDraft
      ? recentEntry(kind.kind, trackedDraft.id, trackedDraft.draft_data?.name || name || `Untitled ${kind.label}`, {
          isDraft: true,
          imageUrl: trackedDraft.draft_data?.localImages?.[0]?.url,
          barId: trackedDraft.bar_id ?? barId ?? null,
        })
      : null
  );

  React.useEffect(() => {
    if (needsCleanMark) {
      setCleanStateStr(currentStateStr);
      setNeedsCleanMark(false);
    }
  }, [needsCleanMark, currentStateStr]);

  React.useEffect(() => {
    if (!currentDraftId || drafts.length === 0 || draftLoadedRef.current === currentDraftId || isFetching) return;
    draftLoadedRef.current = currentDraftId;
    const data = drafts.find((d: any) => d.id === currentDraftId)?.draft_data;
    if (!data) return;
    form.setName(data.name || '');
    form.setDescription(data.description || '');
    form.setMaker(data[kind.maker.draftKey] || '');
    form.setAbv(data.abv || '');
    form.setPrice(data.price || '');
    form.setSelectedCategories(data.selectedCategories || []);
    form.setLocalImages(data.localImages || []);
    form.setBarId(data.barId || initialBarId || null);
    form.setOverrideVisibility(data.overrideVisibility || null);
    form.setOverrideGeneric(data.overrideGeneric || null);
    form.setOverrideSpecific(data.overrideSpecific || null);
    form.setOverrideMeasurement(data.overrideMeasurement || null);
    form.setOverridePrep(data.overridePrep || null);
    setNeedsCleanMark(true);
    // Runs once per draft; `form` setters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraftId, drafts, isFetching]);

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      const result = await saveDraft({ id: currentDraftId || undefined, entityType: kind.kind, draftData });
      if (!currentDraftId && result?.id) {
        setCurrentDraftId(result.id);
        if (!isInline) router.setParams({ draftId: result.id });
      }
      showMessage('Draft saved', 'You can finish it later from Unfinished items.');
      setNeedsCleanMark(true);
    } catch (error) {
      console.error('Draft error:', error);
      showMessage('Error', 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  // Ask before leaving with unsaved work (on web this also guards closing the tab).
  const allowExit = usePreventRemove(!isInline && !exiting && hasProgress(), ({ repeat }) => {
    pendingExitRef.current = repeat;
    setShowExitModal(true);
  });

  const confirmExit = async (shouldSave: boolean) => {
    setShowExitModal(false);
    if (shouldSave) await handleSaveDraft();
    if (isInline) {
      onClose?.();
    } else if (pendingExitRef.current) {
      setExiting(true);
      pendingExitRef.current();
    }
  };

  // Drafts keep their photos online, so they survive closing the app.
  const addImages = async (uris: string[]) => {
    if (!uris.length) return;
    setSaving(true);
    try {
      const uploaded: { id: string; url: string; isNew: boolean }[] = [];
      for (const uri of uris) {
        const image = await uploadDrinkPhoto(uri, 'drafts');
        if (image) uploaded.push({ ...image, isNew: false });
      }
      setLocalImages((prev) => [...prev, ...uploaded]);
    } catch (error) {
      console.error('Error uploading drafted image', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!name?.trim()) {
      Alert.alert('Missing Info', 'Name is required.');
      return;
    }
    const ok = await confirmAsync({
      title: `Publish ${kind.label}`,
      message: `Are you sure you want to publish this ${kind.label.toLowerCase()}?`,
      confirmText: 'Publish',
    });
    if (ok) await performPublish();
  };

  const performPublish = async () => {
    setSaving(true);
    try {
      const { data: created, error: insertError } = await supabase
        .from('items')
        .insert({ item_type: kind.kind, ...drinkColumns(form) })
        .select()
        .single();
      if (insertError || !created) throw insertError;
      const newId: string = created.id;

      const imageIds: string[] = [];
      for (const img of localImages) {
        if (img.isNew) {
          const imageId = await imageIdFor(img.url, `${kind.storageFolder}/${newId}`);
          if (!imageId) throw new Error('Failed to upload image');
          imageIds.push(imageId);
        } else if (img.id) {
          imageIds.push(img.id);
        }
      }
      await setItemImages(newId, imageIds, { replace: false });

      for (const catId of selectedCategories) {
        await supabase
          .from('item_categories')
          .upsert({ item_id: newId, category_id: catId, is_primary: true }, { onConflict: 'item_id,category_id' });
      }

      queryClient.invalidateQueries({ queryKey: [kind.listQueryKey] });
      await queryClient.invalidateQueries({ queryKey: ['dropdowns_v2'] });
      if (currentDraftId) {
        await updateMenuDraftsWithPublishedId(`${kind.kind}-${currentDraftId}`, `${kind.kind}-${newId}`, drafts, saveDraft);
        await deleteDraft(currentDraftId);
      }
      if (barId) queryClient.invalidateQueries({ queryKey: ['bar', barId] });

      Alert.alert('Success', `${kind.label} created!`, [
        {
          text: 'OK',
          onPress: () => {
            setExiting(true);
            allowExit();
            if (isInline) onSave?.();
            else router.back();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Creation error:', error);
      Alert.alert('Error', error?.message || `Failed to create ${kind.label.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModalProvider>
      <YStack style={styles.container} backgroundColor="$background">
        {!isInline && <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />}

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
            onPress={() => {
              if (!isInline) router.back();
              else if (hasProgress()) setShowExitModal(true);
              else onClose?.();
            }}
            style={styles.headerBtn}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
          </TouchableOpacity>
          <Text fontSize="$5" fontWeight="bold">
            Add {kind.label}
          </Text>
          <Button onPress={handlePublish} disabled={saving} size="$3" chromeless>
            {saving ? (
              <ActivityIndicator size="small" color={theme.color8?.get() as string} />
            ) : (
              <Text color="$color8" fontWeight="bold">
                Save
              </Text>
            )}
          </Button>
        </XStack>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
            <SortableImageList
              images={localImages}
              onReorder={setLocalImages}
              onRemove={(index) => setLocalImages(localImages.filter((_, i) => i !== index))}
              onAdd={async () => addImages(await pickDrinkPhotos())}
              onAddUris={(uris) => {
                void addImages(uris);
              }}
            />
            <DrinkFormFields kind={kind} form={form} />
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={showExitModal} transparent animationType="fade" onRequestClose={() => setShowExitModal(false)}>
          <View style={[StyleSheet.absoluteFill, styles.scrim]}>
            <YStack
              backgroundColor="$backgroundStrong"
              padding="$5"
              borderRadius="$4"
              width="85%"
              maxWidth={400}
              borderWidth={1}
              borderColor="$borderColor"
              gap="$4"
            >
              <Text fontSize="$6" fontWeight="bold" color="$color">
                Unsaved Changes
              </Text>
              <Text fontSize="$4" color="$color11">
                You have unsaved changes. Do you want to save your draft before leaving?
              </Text>
              <XStack justifyContent="flex-end" gap="$3" marginTop="$2">
                <Button size="$3" chromeless onPress={() => setShowExitModal(false)}>
                  <Text color="$color11">Cancel</Text>
                </Button>
                <Button size="$3" backgroundColor="$red10" onPress={() => confirmExit(false)}>
                  <Text color="white" fontWeight="bold">
                    Discard
                  </Text>
                </Button>
                <Button size="$3" backgroundColor="$color8" onPress={() => confirmExit(true)}>
                  <Text color="$backgroundStrong" fontWeight="bold">
                    Save
                  </Text>
                </Button>
              </XStack>
            </YStack>
          </View>
        </Modal>
      </YStack>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
});
