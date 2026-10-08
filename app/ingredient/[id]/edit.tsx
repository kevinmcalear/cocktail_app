import { BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Switch,
    TouchableOpacity,
} from "react-native";

import { BarAssignmentAccordion } from "@/components/BarAssignmentAccordion";
import { CategoryPickerModal } from "@/components/CategoryPickerModal";
import { IngredientPickerSheet } from "@/components/IngredientPickerSheet";
import { BrandAndKindFields } from "@/components/ingredient/BrandAndKindFields";
import { IngredientDrawing } from "@/components/ds";
import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { SortableRecipeList, type SortableRecipeItem } from "@/components/recipe/SortableRecipeList";
import { PrepCalcButton } from "@/components/tools/ToolsSheet";
import { useDrafts } from "@/hooks/useDrafts";
import { refreshIngredients, useDropdowns } from "@/hooks/useDropdowns";
import { useIngredient } from "@/hooks/useIngredients";
import { useRecipeMergeHandler } from "@/hooks/useRecipeMergeHandler";
import { renameIngredientEntity } from "@/lib/drafts";
import { fetchEditableRecipes } from "@/lib/editableRecipes";
import type { EditorChromeState } from "@/lib/editorChrome";
import { applyIngredientHandoff } from "@/lib/ingredientHandoff";
import {
    mapPresentationRecipeToEditItem,
} from "@/lib/recipeUtils";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { getPreferredUnit } from "@/store/useSettingsStore";
import { useQueryClient } from "@tanstack/react-query";
import { Input, Label, Text, TextArea, XStack, YStack, useTheme } from "tamagui";

interface RecipeItem {
    id?: string;
    ingredient_id: string;
    name: string;
    amount: string;
    unit: string;
}

interface EditIngredientProps {
    isInline?: boolean;
    idProp?: string;
    onClose?: () => void;
    onSave?: () => void;
    onNestedItemPress?: (ingredientId: string) => void;
    onChromeState?: (state: EditorChromeState | null) => void;
}

export default function EditIngredientScreen({
    isInline,
    idProp,
    onClose,
    onSave,
    onNestedItemPress,
    onChromeState,
}: EditIngredientProps = {}) {
    const { id: paramId } = useLocalSearchParams<{ id: string }>();
    const id = idProp !== undefined ? idProp : paramId;
    const router = useRouter();
    const theme = useTheme();

    const [saving, setSaving] = useState(false);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [brandMaker, setBrandMaker] = useState("");
    const [generic, setGeneric] = useState<{ id: string; name: string } | null>(null);
    const [abv, setAbv] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const categoryPickerRef = useRef<BottomSheetModal>(null);

    const [barId, setBarId] = useState<string | null>(null);
    const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
    const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
    const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
    const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
    const [overridePrep, setOverridePrep] = useState<string | null>(null);
    const [hideFromSearch, setHideFromSearch] = useState(false);

    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const { drafts, saveDraft } = useDrafts();
    const { recentlyCreatedItem, setRecentlyCreatedItem } = useAppStore();

    const setMergeRecipeItems = useCallback((items: SortableRecipeItem[]) => {
        setRecipeItems(items);
    }, []);

    useEffect(() => {
        if (recentlyCreatedItem?.type !== "ingredient") return;
        const handoff = recentlyCreatedItem;
        if (!handoff.targetId || !id || handoff.targetId !== id) return;
        setRecipeItems(
            (prev) =>
                applyIngredientHandoff(prev, handoff, id, {
                    amount: "",
                    unit: getPreferredUnit(),
                }) ?? prev
        );
        setRecentlyCreatedItem(null);
    }, [recentlyCreatedItem, setRecentlyCreatedItem, id]);

    const { onMerge } = useRecipeMergeHandler({
        items: recipeItems,
        setItems: setMergeRecipeItems,
        persistence: "published",
        barId,
        drafts,
        saveDraft,
        parentName: name,
    });

    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns({ ingredients: true });
    const { data, isLoading: loadingIngredient } = useIngredient(id as string);
    const [rawLoaded, setRawLoaded] = useState(false);
    const loading = loadingDropdowns || loadingIngredient || (!!data?.ingredient && !rawLoaded);

    const cleanStateRef = useRef<string | null>(null);
    const [needsCleanMark, setNeedsCleanMark] = useState(false);
    const currentStateStr = JSON.stringify({
        name,
        description,
        brandMaker,
        generic,
        abv,
        selectedCategories,
        recipeItems,
        barId,
        overrideVisibility,
        overrideGeneric,
        overrideSpecific,
        overrideMeasurement,
        overridePrep,
        hideFromSearch,
    });
    const isDirty = cleanStateRef.current !== null && currentStateStr !== cleanStateRef.current;

    const pickerIngredients = useMemo(() => {
        const published = (dropdowns?.ingredients || []).map((i: any) => ({ id: i.id, name: i.name }));
        const draftIngredients = drafts
            .filter((d: any) => d.entity_type === "ingredient")
            .map((d: any) => ({
                id: d.id,
                name: d.draft_data?.name || "Untitled Ingredient Draft",
            }));
        const combined = [...draftIngredients, ...published];
        const seen = new Set<string>();
        return combined.filter((i) => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
        });
    }, [dropdowns?.ingredients, drafts]);

    useEffect(() => {
        if (!data?.ingredient) return;

        setName(data.ingredient.name || "");
        setDescription(data.ingredient.description || "");
        setBrandMaker(data.ingredient.brand_maker || "");
        setGeneric(data.ingredient.generic ?? null);
        setAbv(data.ingredient.abv?.toString() || "");
        setBarId(data.ingredient.bar_id || null);
        setHideFromSearch(data.ingredient.hide_from_search === true);

        if (data.ingredient.item_categories) {
            setSelectedCategories(data.ingredient.item_categories.map((ic: any) => ic.category_id));
        }


        // Recipe rows and visibility overrides come from the raw tables: the
        // presentation views mask or omit them, and a save writes them all back.
        let cancelled = false;
        setRawLoaded(false);
        Promise.all([
            fetchEditableRecipes(id as string),
            supabase
                .from("items")
                .select(
                    "override_visibility_level, override_generic_ingredient_level, override_specific_brand_level, override_measurement_level, override_prep_level"
                )
                .eq("id", id as string)
                .single(),
        ])
            .then(([recipes, { data: raw, error }]) => {
                if (cancelled) return;
                if (error || !raw) throw error ?? new Error("Ingredient not found");
                setRecipeItems(recipes.map((r) => mapPresentationRecipeToEditItem(r)));
                setOverrideVisibility(raw.override_visibility_level?.toString() || null);
                setOverrideGeneric(raw.override_generic_ingredient_level?.toString() || null);
                setOverrideSpecific(raw.override_specific_brand_level?.toString() || null);
                setOverrideMeasurement(raw.override_measurement_level?.toString() || null);
                setOverridePrep(raw.override_prep_level?.toString() || null);
                setRawLoaded(true);
                setNeedsCleanMark(true);
            })
            .catch(() => {
                if (!cancelled) Alert.alert("Error", "Could not load this ingredient for editing.");
            });
        return () => {
            cancelled = true;
        };
    }, [data, id]);

    useEffect(() => {
        if (!needsCleanMark) return;
        cleanStateRef.current = currentStateStr;
        setNeedsCleanMark(false);
    }, [needsCleanMark, currentStateStr]);

    const handleClose = () => {
        if (onClose) onClose();
        else router.back();
    };

    const handleSave = async () => {
        if (!rawLoaded) return false;
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return false;
        }
        setSaving(true);
        try {
            const { error: updateError } = await supabase
                .from("items")
                .update({
                    name: capitalize(name),
                    description: description.trim() || null,
                    brand_maker: capitalize(brandMaker) || null,
                    generic_id: generic?.id ?? null,
                    abv: abv ? parseFloat(abv) : null,
                    bar_id: barId || null,
                    override_visibility_level: overrideVisibility ? parseInt(overrideVisibility) : null,
                    override_generic_ingredient_level: overrideGeneric ? parseInt(overrideGeneric) : null,
                    override_specific_brand_level: overrideSpecific ? parseInt(overrideSpecific) : null,
                    override_measurement_level: overrideMeasurement ? parseInt(overrideMeasurement) : null,
                    override_prep_level: overridePrep ? parseInt(overridePrep) : null,
                    hide_from_search: hideFromSearch,
                })
                .eq("id", id);

            if (updateError) throw updateError;

            const { data: existingCatLinks } = await supabase
                .from("item_categories")
                .select("category_id")
                .eq("item_id", id);

            const existingCatIds = existingCatLinks?.map((l) => l.category_id) || [];
            const catIdsToDelete = existingCatIds.filter((eid) => !selectedCategories.includes(eid));
            const catIdsToAdd = selectedCategories.filter((eid) => !existingCatIds.includes(eid));

            if (catIdsToDelete.length > 0) {
                await supabase
                    .from("item_categories")
                    .delete()
                    .eq("item_id", id)
                    .in("category_id", catIdsToDelete);
            }

            for (const catId of catIdsToAdd) {
                await supabase.from("item_categories").upsert(
                    {
                        item_id: id,
                        category_id: catId,
                        is_primary: true,
                    },
                    { onConflict: "item_id,category_id" }
                );
            }

            const { error: deleteError } = await supabase.from("recipes").delete().eq("recipe_item_id", id);
            if (deleteError) throw deleteError;

            if (recipeItems.length > 0) {
                const recipeInserts = recipeItems.map((item, index) => ({
                    recipe_item_id: id,
                    ingredient_item_id: item.ingredient_id,
                    amount: parseFloat(item.amount) || null,
                    unit: item.unit || null,
                    sort_order: index,
                }));

                const { error: insertError } = await supabase.from("recipes").insert(recipeInserts);
                if (insertError) throw insertError;
            }

            await queryClient.invalidateQueries({ queryKey: ["ingredient", id] });
            await queryClient.invalidateQueries({ queryKey: ["ingredients"] });
            await queryClient.invalidateQueries({ queryKey: ["cocktail"] });
            await queryClient.invalidateQueries({ queryKey: ["cocktails"] });
            await refreshIngredients(queryClient, [id]);

            cleanStateRef.current = currentStateStr;

            if (isInline) {
                if (onClose) onClose();
                else if (onSave) onSave();
            } else {
                Alert.alert("Success", "Ingredient updated!", [
                    { text: "OK", onPress: () => router.back() },
                ]);
            }
            return true;
        } catch (error: any) {
            console.error("Update error:", error);
            Alert.alert("Error", error.message || "Failed to update ingredient.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!isInline || !onChromeState || loading) return;
        onChromeState({
            save: async () => {
                await handleSave();
            },
            cancel: handleClose,
            saving,
            isDirty,
        });
        return () => onChromeState(null);
        // ponytail: chrome mirrors form fields; listing handleSave would churn every render
    }, [isInline, onChromeState, loading, saving, isDirty, currentStateStr]);

    if (loading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
                <ActivityIndicator size="large" color={theme.color8?.get() as string} />
            </YStack>
        );
    }

    return (
        <BottomSheetModalProvider>
            {!isInline && <Stack.Screen options={{ headerShown: false, presentation: "modal" }} />}

            <ItemDetailLayout
                id={id as string}
                title={name}
                // Ingredients are drawn, not photographed: the drawing follows the name and kind.
                images={[]}
                hero={<IngredientDrawing id={id} name={name} />}
                isFavorite={false}
                onToggleFavorite={() => {}}
                embedded={!!isInline}
                isEditing
                editableTitle={{
                    value: name,
                    onChange: (val) => handleCapitalizedChange(val, name, setName),
                    onBlur: () => setName(capitalize(name)),
                    placeholder: "Ingredient name",
                }}
                onBack={isInline ? undefined : handleClose}
                onCancelEdit={isInline ? undefined : handleClose}
                onSave={
                    isInline
                        ? undefined
                        : () => {
                              void handleSave();
                          }
                }
                saving={saving}
                isDirty={isDirty}
            >
                <YStack gap="$4" marginBottom="$6" paddingHorizontal={24}>
                    <YStack gap="$2">
                        <Text fontSize={18} fontWeight="bold" color="$color">
                            Recipe
                        </Text>
                        <PrepCalcButton name={name} catalog={pickerIngredients} recipe={recipeItems} barId={barId} saveDraft={saveDraft} onApply={setRecipeItems} />
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
                            onNestedItemPress={onNestedItemPress}
                            onRenameIngredient={async (ingredientId, nextName) => {
                                try {
                                    await renameIngredientEntity(ingredientId, nextName, drafts, saveDraft);
                                } catch (e: any) {
                                    const msg = e?.message || "Failed to rename ingredient.";
                                    Alert.alert("Error", msg);
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
                        <BrandAndKindFields
                            brandMaker={brandMaker}
                            onBrandMaker={setBrandMaker}
                            generic={generic}
                            onGeneric={setGeneric}
                            ingredients={pickerIngredients}
                            excludeId={id}
                            sameAs={{ name, barId, rows: dropdowns?.ingredients ?? [], aliases: dropdowns?.ingredientAliases }}
                        />

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
                ingredients={pickerIngredients}
                excludeId={id}
                drafts={drafts}
                dropdowns={dropdowns} loading={!dropdowns?.ingredients}
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
                    router.push({
                        pathname: "/add-ingredient",
                        params: {
                            name: query,
                            barId: barId || "",
                            attachTo: id || "",
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
        </BottomSheetModalProvider>
    );
}
