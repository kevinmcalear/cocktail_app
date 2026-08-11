import { BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack, useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
    Alert,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Modal,
    Switch,
    View,
} from "react-native";

import { BarAssignmentAccordion } from "@/components/BarAssignmentAccordion";
import { CategoryPickerModal } from "@/components/CategoryPickerModal";
import { IngredientPickerSheet } from "@/components/IngredientPickerSheet";
import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { SortableRecipeList, type SortableRecipeItem } from "@/components/recipe/SortableRecipeList";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useDrafts } from "@/hooks/useDrafts";
import { useRecipeMergeHandler } from "@/hooks/useRecipeMergeHandler";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { renameIngredientEntity, resolveIngredientId, syncIngredientRefsInParentDrafts, updateParentDraftsWithPublishedId } from "@/lib/drafts";
import type { EditorChromeState } from "@/lib/editorChrome";
import { applyIngredientHandoff, withoutSelfRecipeRefs } from "@/lib/ingredientHandoff";
import { buildIngredientImageMap } from "@/lib/recipeUtils";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { getPreferredUnit } from "@/store/useSettingsStore";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme } from "tamagui";

interface RecipeItem {
    id?: string;
    ingredient_id: string;
    name: string;
    amount: string;
    unit: string;
}

interface AddIngredientProps {
    isInline?: boolean;
    draftIdProp?: string;
    barIdProp?: string;
    onClose?: () => void;
    onSave?: () => void;
    onNestedItemPress?: (ingredientId: string) => void;
    onChromeState?: (state: EditorChromeState | null) => void;
}

export default function AddIngredientScreen({ isInline, draftIdProp, barIdProp, onClose, onSave, onNestedItemPress, onChromeState }: AddIngredientProps = {}) {
    const router = useRouter();
    const { barId: initialBarId, draftId, name: initialNameParam, attachTo } = useLocalSearchParams<{
        barId?: string;
        draftId?: string;
        name?: string;
        attachTo?: string;
    }>();
    const activeDraftIdProp = draftIdProp !== undefined ? draftIdProp : draftId;
    const activeBarIdProp = barIdProp !== undefined ? barIdProp : initialBarId;
    const attachToParentId = typeof attachTo === 'string' && attachTo ? attachTo : null;
    const navigation = useNavigation();
    const theme = useTheme();

    const [saving, setSaving] = useState(false);
    const queryClient = useQueryClient();

    const { drafts, saveDraft, deleteDraft, isFetching } = useDrafts();
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(activeDraftIdProp || null);

    const [showExitModal, setShowExitModal] = useState(false);
    const pendingNavigationActionRef = useRef<any>(null);
    const isExitingRef = useRef(false);

    // Form State
    const [name, setName] = useState(initialNameParam ? capitalize(initialNameParam) : "");
    const [description, setDescription] = useState("");
    const [brandMaker, setBrandMaker] = useState("");
    const [abv, setAbv] = useState("");

    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const categoryPickerRef = useRef<BottomSheetModal>(null);

    // Bar Assignment and Overrides
    const [barId, setBarId] = useState<string | null>(activeBarIdProp || null);
    const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
    const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
    const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
    const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
    const [overridePrep, setOverridePrep] = useState<string | null>(null);
    const [hideFromSearch, setHideFromSearch] = useState(false);

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);

    const { data: dropdowns } = useDropdowns();

    const setMergeRecipeItems = useCallback((items: SortableRecipeItem[]) => {
        setRecipeItems(items);
    }, []);

    const { onMerge } = useRecipeMergeHandler({
        items: recipeItems,
        setItems: setMergeRecipeItems,
        persistence: 'draft',
        barId,
        drafts,
        saveDraft,
        parentName: name,
    });

    const mergedIngredients = useMemo(() => {
        const published = (dropdowns?.ingredients || []).map((i: any) => ({
            id: i.id,
            name: i.name
        }));

        const draftIngredients = drafts
            .filter((d: any) => d.entity_type === 'ingredient')
            .map((d: any) => ({
                id: d.id,
                name: d.draft_data?.name || "Untitled Ingredient Draft"
            }));

        const combined = [...draftIngredients, ...published];
        const seen = new Set();
        return combined.filter((i: any) => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
        });
    }, [dropdowns?.ingredients, drafts]);

    const { recentlyCreatedItem, setRecentlyCreatedItem } = useAppStore();

    useEffect(() => {
        if (recentlyCreatedItem?.type !== 'ingredient') return;
        const handoff = recentlyCreatedItem;
        // Only the parent that opened create may attach (prevents self-add + sibling theft)
        if (!handoff.targetId || !currentDraftId || handoff.targetId !== currentDraftId) return;
        setRecipeItems((prev) =>
            applyIngredientHandoff(prev, handoff, currentDraftId, { amount: "", unit: getPreferredUnit() }) ?? prev
        );
        setRecentlyCreatedItem(null);
    }, [recentlyCreatedItem, setRecentlyCreatedItem, currentDraftId]);

    const ingredientImageMap = useMemo(
        () => buildIngredientImageMap(undefined, dropdowns?.ingredients),
        [dropdowns?.ingredients]
    );

    const draftLoadedRef = useRef<string | null>(null);
    const currentStateStr = JSON.stringify({ name, description, brandMaker, abv, selectedCategories, recipeItems, barId, overrideVisibility, overrideGeneric, overrideSpecific, overrideMeasurement, overridePrep, hideFromSearch });
    const cleanStateStrRef = useRef<string>(currentStateStr);
    const [needsCleanMark, setNeedsCleanMark] = useState(false);

    const trackedDraft = currentDraftId
        ? drafts.find((d: any) => d.id === currentDraftId)
        : null;
    useTrackRecent(
        !!trackedDraft,
        trackedDraft
            ? recentEntry(
                  'ingredient',
                  trackedDraft.id,
                  trackedDraft.draft_data?.name || name || 'Untitled Ingredient',
                  {
                      isDraft: true,
                      barId: trackedDraft.bar_id ?? barId ?? null,
                  }
              )
            : null
    );

    useEffect(() => {
        if (needsCleanMark) {
            cleanStateStrRef.current = currentStateStr;
            setNeedsCleanMark(false);
        }
    }, [needsCleanMark, currentStateStr]);

    useEffect(() => {
        if (currentDraftId && drafts.length > 0 && draftLoadedRef.current !== currentDraftId) {
            if (isFetching) return;
            
            const draft = drafts.find((d: any) => d.id === currentDraftId);
            if (draft && draft.draft_data) {
                draftLoadedRef.current = currentDraftId;
                const data = draft.draft_data;
                setName(data.name || "");
                setDescription(data.description || "");
                setBrandMaker(data.brandMaker || "");
                setAbv(data.abv || "");
                setSelectedCategories(data.selectedCategories || []);
                setRecipeItems(withoutSelfRecipeRefs(data.recipeItems || [], currentDraftId));
                setBarId(data.barId || initialBarId || null);
                setOverrideVisibility(data.overrideVisibility || null);
                setOverrideGeneric(data.overrideGeneric || null);
                setOverrideSpecific(data.overrideSpecific || null);
                setOverrideMeasurement(data.overrideMeasurement || null);
                setOverridePrep(data.overridePrep || null);
                setHideFromSearch(data.hideFromSearch === true);
                setNeedsCleanMark(true);
            } else {
                draftLoadedRef.current = currentDraftId;
            }
        }
    }, [currentDraftId, drafts, isFetching]);

    const handleSaveDraft = async (silent = false) => {
        try {
            setSaving(true);
            const safeRecipeItems = withoutSelfRecipeRefs(recipeItems, currentDraftId);
            if (safeRecipeItems.length !== recipeItems.length) setRecipeItems(safeRecipeItems);
            const draftData = { name, description, brandMaker, abv, selectedCategories, recipeItems: safeRecipeItems, barId, overrideVisibility, overrideGeneric, overrideSpecific, overrideMeasurement, overridePrep, hideFromSearch };
            const result = await saveDraft({ id: currentDraftId || undefined, entityType: 'ingredient', draftData });
            
            let updatedDraftId = currentDraftId;
            if (!currentDraftId && result && result.id) {
                updatedDraftId = result.id;
                setCurrentDraftId(result.id);
                if (!isInline) {
                    router.setParams({ draftId: result.id });
                }
            }

            const draftIdToNotify = updatedDraftId || (result && result.id);
            if (draftIdToNotify) {
                const displayName = capitalize(name.trim()) || "Untitled Ingredient Draft";
                // Only notify the parent that opened create — never broadcast to every mounted editor
                if (attachToParentId) {
                    setRecentlyCreatedItem({
                        type: 'ingredient',
                        id: draftIdToNotify,
                        name: displayName,
                        targetId: attachToParentId,
                    });
                }
                // Keep parent cocktail/ingredient recipe lines in sync (merge-created "New batch")
                await syncIngredientRefsInParentDrafts(
                    draftIdToNotify,
                    { name: displayName },
                    drafts,
                    saveDraft
                );
            }
            
            if (!silent) {
                if (Platform.OS === 'web') {
                    window.alert("Draft saved successfully!");
                } else {
                    Alert.alert("Success", "Draft saved successfully!");
                }
            }
            setNeedsCleanMark(true);
            return draftIdToNotify;
        } catch (error) {
            console.error("Draft error:", error);
            if (!silent) {
                if (Platform.OS === 'web') {
                    window.alert("Failed to save draft.");
                } else {
                    Alert.alert("Error", "Failed to save draft.");
                }
            }
            return null;
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (isInline) return;
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (isExitingRef.current) {
                return;
            }
            const hasProgress = name.trim() !== "" || currentDraftId !== null || currentStateStr !== cleanStateStrRef.current;
            if (!hasProgress) {
                return;
            }
            e.preventDefault();
            pendingNavigationActionRef.current = e.data.action;
            setShowExitModal(true);
        });

        return unsubscribe;
    }, [navigation, currentStateStr, name, currentDraftId, isInline]);

    const confirmExit = async (shouldSave: boolean) => {
        setShowExitModal(false);
        if (shouldSave) {
            await handleSaveDraft();
        }
        if (isInline) {
            if (onClose) onClose();
        } else if (pendingNavigationActionRef.current) {
            isExitingRef.current = true;
            navigation.dispatch(pendingNavigationActionRef.current);
        }
    };

    const handleSave = () => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }

        const proceed = () => {
            performSave();
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to publish this ingredient?")) {
                proceed();
            }
        } else {
            Alert.alert(
                "Publish Ingredient",
                "Are you sure you want to publish this ingredient?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Publish", onPress: proceed }
                ]
            );
        }
    };

    const performSave = async () => {
        setSaving(true);
        try {
            // Resolve draft ingredients recursively before publishing this complex ingredient
            const resolvedRecipeItems = [];
            for (const item of withoutSelfRecipeRefs(recipeItems, currentDraftId)) {
                const resolvedId = await resolveIngredientId(item.ingredient_id, drafts);
                if (resolvedId !== item.ingredient_id) {
                    await updateParentDraftsWithPublishedId(item.ingredient_id, resolvedId, drafts, saveDraft);
                }
                resolvedRecipeItems.push({
                    ...item,
                    ingredient_id: resolvedId
                });
            }

            // 1. Create Ingredient
            const { data: ingredient, error: ingredientError } = await supabase
                .from('items')
                .insert({
                    name: capitalize(name),
                    description: description.trim() || null,
                    item_type: 'ingredient',
                    brand_maker: capitalize(brandMaker) || null,
                    abv: abv ? parseFloat(abv) : null,
                    bar_id: barId || null,
                    override_visibility_level: overrideVisibility ? parseInt(overrideVisibility) : null,
                    override_generic_ingredient_level: overrideGeneric ? parseInt(overrideGeneric) : null,
                    override_specific_brand_level: overrideSpecific ? parseInt(overrideSpecific) : null,
                    override_measurement_level: overrideMeasurement ? parseInt(overrideMeasurement) : null,
                    override_prep_level: overridePrep ? parseInt(overridePrep) : null,
                    hide_from_search: hideFromSearch,
                })
                .select()
                .single();

            if (ingredientError || !ingredient) throw ingredientError;

            const ingredientId = ingredient.id;

            // Categories
            for (const catId of selectedCategories) {
                await supabase
                    .from('item_categories')
                    .upsert({
                        item_id: ingredientId,
                        category_id: catId,
                        is_primary: true
                    }, { onConflict: 'item_id,category_id' });
            }

            if (resolvedRecipeItems.length > 0) {
                const recipeInserts = resolvedRecipeItems.map((item, index) => ({
                    recipe_item_id: ingredientId,
                    ingredient_item_id: item.ingredient_id,
                    amount: parseFloat(item.amount) || null,
                    unit: item.unit || null,
                    sort_order: index,
                }));

                const { error: recipeError } = await supabase
                    .from('recipes')
                    .insert(recipeInserts);

                if (recipeError) throw recipeError;
            }

            queryClient.invalidateQueries({ queryKey: ['ingredients'] });
            await queryClient.invalidateQueries({ queryKey: ['dropdowns_v2'] });
            if (currentDraftId) {
                await updateParentDraftsWithPublishedId(
                    currentDraftId,
                    ingredientId,
                    drafts,
                    saveDraft,
                    capitalize(name)
                );
                await deleteDraft(currentDraftId);
            }
            if (barId) {
                queryClient.invalidateQueries({ queryKey: ['bar', barId] });
            }

            if (attachToParentId) {
                setRecentlyCreatedItem({
                    type: 'ingredient',
                    id: ingredientId,
                    name: name.trim(),
                    targetId: attachToParentId,
                    replacedId: currentDraftId,
                });
            }

            Alert.alert("Success", "Ingredient created!", [
                { text: "OK", onPress: () => {
                    isExitingRef.current = true;
                    if (isInline) {
                        // ponytail: pop nested stack (onSave clears whole workspace)
                        if (onClose) onClose();
                        else if (onSave) onSave();
                    } else {
                        router.back();
                    }
                } }
            ]);

        } catch (error: any) {
            console.error("Creation error:", error);
            Alert.alert("Error", error.message || "Failed to create ingredient.");
        } finally {
            setSaving(false);
        }
    };

    // ponytail: existing draft (e.g. merge-created batch) → Save persists draft; brand-new → publish
    const handleHeaderSave = async () => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }
        if (currentDraftId) {
            const savedId = await handleSaveDraft(true);
            if (!savedId) return;
            if (isInline) {
                onClose?.();
            } else if (Platform.OS === 'web') {
                window.alert("Draft saved successfully!");
            } else {
                Alert.alert("Success", "Draft saved successfully!");
            }
            return;
        }
        handleSave();
    };

    useEffect(() => {
        if (!isInline || !onChromeState) return;
        const dirty = currentStateStr !== cleanStateStrRef.current;
        onChromeState({
            save: async () => {
                await handleHeaderSave();
            },
            cancel: () => {
                if (dirty) setShowExitModal(true);
                else onClose?.();
            },
            saving,
            isDirty: dirty || Boolean(name.trim()) || currentDraftId !== null,
        });
        return () => onChromeState(null);
        // ponytail: chrome rebinds when draft fields change so Save isn't stale
    }, [isInline, onChromeState, saving, currentStateStr, name, currentDraftId, recipeItems, description, brandMaker, abv, selectedCategories, barId]);

    const handleBack = () => {
        if (isInline) {
            const hasProgress =
                name.trim() !== "" || currentDraftId !== null || currentStateStr !== cleanStateStrRef.current;
            if (hasProgress) setShowExitModal(true);
            else onClose?.();
        } else {
            router.back();
        }
    };

    const dirty = currentStateStr !== cleanStateStrRef.current;

    return (
        <BottomSheetModalProvider>
            {!isInline && <Stack.Screen options={{ headerShown: false, presentation: "modal" }} />}

            <ItemDetailLayout
                id={currentDraftId || "new-ingredient"}
                title={name}
                images={[]}
                emptyPhotoPlaceholder
                isFavorite={false}
                isInStudyPile={false}
                onToggleFavorite={() => {}}
                onToggleStudyPile={() => {}}
                embedded={!!isInline}
                isEditing
                editableTitle={{
                    value: name,
                    onChange: (val) => handleCapitalizedChange(val, name, setName),
                    onBlur: () => setName(capitalize(name)),
                    placeholder: "e.g. Rich Simple Syrup",
                }}
                onBack={isInline ? undefined : handleBack}
                onCancelEdit={isInline ? undefined : handleBack}
                onSave={
                    isInline
                        ? undefined
                        : () => {
                              void handleHeaderSave();
                          }
                }
                saving={saving}
                isDirty={dirty || Boolean(name.trim()) || currentDraftId !== null}
            >
                <YStack gap="$4" marginBottom="$6" paddingHorizontal={24}>
                    <YStack gap="$2">
                        <Text fontSize={18} fontWeight="bold" color="$color">
                            Recipe
                        </Text>
                        {recipeItems.length === 0 && (
                            <Text color="$color11" fontSize={14} fontStyle="italic">
                                Add ingredients if this is a pre-batched item (e.g. syrups, infusions). Leave empty
                                for raw ingredients.
                            </Text>
                        )}
                        <SortableRecipeList
                            items={recipeItems}
                            onReorder={setRecipeItems}
                            onUpdateItem={(index, updates) => {
                                const next = [...recipeItems];
                                next[index] = { ...next[index], ...updates };
                                setRecipeItems(next);
                            }}
                            onRemove={(index) => setRecipeItems(recipeItems.filter((_, i) => i !== index))}
                            onMerge={onMerge}
                            variant="detail"
                            allIngredients={dropdowns?.ingredients}
                            ingredientImageMap={ingredientImageMap}
                            onNestedItemPress={onNestedItemPress}
                            onRenameIngredient={async (ingredientId, nextName) => {
                                try {
                                    await renameIngredientEntity(ingredientId, nextName, drafts, saveDraft);
                                } catch (e: any) {
                                    const msg = e?.message || "Failed to rename ingredient.";
                                    if (Platform.OS === "web") window.alert(msg);
                                    else Alert.alert("Error", msg);
                                }
                            }}
                            drafts={drafts}
                            dropdowns={dropdowns}
                        />
                        <TouchableOpacity
                            onPress={() => setShowIngredientPicker(true)}
                            style={{ alignSelf: "flex-start", marginTop: 4 }}
                        >
                            <Text color={theme.color8?.get() as string} fontWeight="600" fontSize={14}>
                                + Add ingredient
                            </Text>
                        </TouchableOpacity>
                    </YStack>

                    <TextArea
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Add a description..."
                        placeholderTextColor="$color11"
                        size="$4"
                        backgroundColor="transparent"
                        borderWidth={0}
                        color="$color"
                        fontSize={16}
                        padding={0}
                        numberOfLines={4}
                    />

                    <YStack gap="$3" marginTop="$2">
                        <YStack gap="$2">
                            <Label color="$color11">Brand / Maker</Label>
                            <Input
                                value={brandMaker}
                                onChangeText={(val) => handleCapitalizedChange(val, brandMaker, setBrandMaker)}
                                onBlur={() => setBrandMaker(capitalize(brandMaker))}
                                placeholderTextColor="$color11"
                                placeholder="e.g. Campari, Buffalo Trace"
                                size="$4"
                                backgroundColor="transparent"
                                borderWidth={0}
                                borderBottomWidth={1}
                                borderColor="$borderColor"
                                focusStyle={{ borderColor: "$color8" }}
                                paddingHorizontal={0}
                            />
                        </YStack>

                        <YStack gap="$2">
                            <Label color="$color11">ABV (%)</Label>
                            <Input
                                value={abv}
                                onChangeText={setAbv}
                                keyboardType="numeric"
                                placeholderTextColor="$color11"
                                placeholder="e.g. 40"
                                size="$4"
                                backgroundColor="transparent"
                                borderWidth={0}
                                borderBottomWidth={1}
                                borderColor="$borderColor"
                                focusStyle={{ borderColor: "$color8" }}
                                paddingHorizontal={0}
                            />
                        </YStack>

                        <YStack gap="$2">
                            <XStack justifyContent="space-between" alignItems="center">
                                <Label color="$color11">Spirit Tags</Label>
                                <TouchableOpacity onPress={() => categoryPickerRef.current?.present()}>
                                    <Text color={theme.color8?.get() as string} fontWeight="bold">
                                        + Add
                                    </Text>
                                </TouchableOpacity>
                            </XStack>
                            <XStack flexWrap="wrap" gap="$2">
                                {selectedCategories.length === 0 ? (
                                    <Text color="$color11" fontStyle="italic">
                                        No tags selected
                                    </Text>
                                ) : (
                                    selectedCategories.map((catId) => {
                                        const cat = dropdowns?.categories?.find((c: any) => c.id === catId);
                                        if (!cat) return null;
                                        return (
                                            <XStack
                                                key={catId}
                                                backgroundColor="$backgroundStrong"
                                                paddingHorizontal={12}
                                                paddingVertical={6}
                                                borderRadius={16}
                                            >
                                                <Text color="$color">{cat.name}</Text>
                                            </XStack>
                                        );
                                    })
                                )}
                            </XStack>
                        </YStack>

                        <XStack alignItems="center" justifyContent="space-between" gap="$3">
                            <YStack flex={1} gap="$1">
                                <Text fontSize={15} fontWeight="600" color="$color">
                                    Hide in Search
                                </Text>
                                <Text fontSize={12} color="$color11">
                                    Keep this ingredient out of ⌘K (still usable in recipes)
                                </Text>
                            </YStack>
                            <Switch
                                value={hideFromSearch}
                                onValueChange={setHideFromSearch}
                                trackColor={{
                                    false: theme.borderColor?.get() as string,
                                    true: theme.color8?.get() as string,
                                }}
                            />
                        </XStack>

                        <BarAssignmentAccordion
                            barId={barId}
                            setBarId={setBarId}
                            overrideVisibility={overrideVisibility}
                            setOverrideVisibility={setOverrideVisibility}
                            overrideGeneric={overrideGeneric}
                            setOverrideGeneric={setOverrideGeneric}
                            overrideSpecific={overrideSpecific}
                            setOverrideSpecific={setOverrideSpecific}
                            overrideMeasurement={overrideMeasurement}
                            setOverrideMeasurement={setOverrideMeasurement}
                            overridePrep={overridePrep}
                            setOverridePrep={setOverridePrep}
                        />
                    </YStack>
                </YStack>
            </ItemDetailLayout>

            <IngredientPickerSheet
                visible={showIngredientPicker}
                onClose={() => setShowIngredientPicker(false)}
                ingredients={mergedIngredients}
                excludeId={currentDraftId}
                drafts={drafts}
                dropdowns={dropdowns}
                onSelect={(item) => {
                    setRecipeItems([
                        ...recipeItems,
                        {
                            ingredient_id: item.id,
                            name: capitalize(item.name),
                            amount: "",
                            unit: getPreferredUnit(),
                        },
                    ]);
                }}
                onCreate={async (query) => {
                    const parentId = await handleSaveDraft(true);
                    router.push({
                        pathname: "/add-ingredient",
                        params: {
                            name: query,
                            barId: barId || "",
                            attachTo: parentId || currentDraftId || "",
                        },
                    });
                }}
            />

            <CategoryPickerModal
                ref={categoryPickerRef}
                domains={["spirit"]}
                selectedCategoryIds={selectedCategories}
                onToggleCategory={(cat) => {
                    if (selectedCategories.includes(cat.id)) {
                        setSelectedCategories((prev) => prev.filter((cid) => cid !== cat.id));
                    } else {
                        setSelectedCategories((prev) => [...prev, cat.id]);
                    }
                }}
            />

            <Modal
                visible={showExitModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowExitModal(false)}
            >
                <View
                    style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
                    ]}
                >
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
                            <Button size="$3" backgroundColor="#ff4444" onPress={() => confirmExit(false)}>
                                <Text color="white" fontWeight="bold">
                                    Discard
                                </Text>
                            </Button>
                            <Button
                                size="$3"
                                backgroundColor={theme.color8?.get() as string}
                                onPress={() => confirmExit(true)}
                            >
                                <Text color={theme.backgroundStrong?.get() as string} fontWeight="bold">
                                    Save
                                </Text>
                            </Button>
                        </XStack>
                    </YStack>
                </View>
            </Modal>
        </BottomSheetModalProvider>
    );
}
