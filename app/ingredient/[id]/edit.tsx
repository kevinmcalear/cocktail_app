import { BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Switch,
    TouchableOpacity,
    View,
} from "react-native";

import { BarAssignmentAccordion } from "@/components/BarAssignmentAccordion";
import { CategoryPickerModal } from "@/components/CategoryPickerModal";
import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { GenerateImageButton } from "@/components/GenerateImageButton";
import { IngredientPickerSheet } from "@/components/IngredientPickerSheet";
import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { SortableRecipeList, type SortableRecipeItem } from "@/components/recipe/SortableRecipeList";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useDrafts } from "@/hooks/useDrafts";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useIngredient } from "@/hooks/useIngredients";
import { useRecipeMergeHandler } from "@/hooks/useRecipeMergeHandler";
import { renameIngredientEntity } from "@/lib/drafts";
import type { EditorChromeState } from "@/lib/editorChrome";
import { imageExtFromUri, uriToBase64 } from "@/lib/imageBase64";
import { applyIngredientHandoff } from "@/lib/ingredientHandoff";
import {
    buildIngredientImageMap,
    mapPresentationRecipeToEditItem,
    sortRecipesByOrder,
} from "@/lib/recipeUtils";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { getPreferredUnit } from "@/store/useSettingsStore";
import { useQueryClient } from "@tanstack/react-query";
import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
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
    const [showPhotoSheet, setShowPhotoSheet] = useState(false);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [localImages, setLocalImages] = useState<{ id?: string; url: string; isNew?: boolean }[]>([]);
    const [brandMaker, setBrandMaker] = useState("");
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
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const { data, isLoading: loadingIngredient } = useIngredient(id as string);
    const loading = loadingDropdowns || loadingIngredient;

    const cleanStateRef = useRef<string | null>(null);
    const [needsCleanMark, setNeedsCleanMark] = useState(false);
    const currentStateStr = JSON.stringify({
        name,
        description,
        brandMaker,
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
        localImages,
    });
    const isDirty = cleanStateRef.current !== null && currentStateStr !== cleanStateRef.current;

    const pickerIngredients = useMemo(() => {
        const published = (dropdowns?.ingredients || []).map((i: any) => ({
            id: i.id,
            name: i.name,
        }));
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

    const ingredientImageMap = useMemo(
        () => buildIngredientImageMap(undefined, dropdowns?.ingredients),
        [dropdowns?.ingredients]
    );

    useEffect(() => {
        if (data?.ingredient) {
            setName(data.ingredient.name || "");
            setDescription(data.ingredient.description || "");
            setBrandMaker(data.ingredient.brand_maker || "");
            setAbv(data.ingredient.abv?.toString() || "");
            setBarId(data.ingredient.bar_id || null);
            setOverrideVisibility(data.ingredient.override_visibility_level?.toString() || null);
            setOverrideGeneric(data.ingredient.override_generic_ingredient_level?.toString() || null);
            setOverrideSpecific(data.ingredient.override_specific_brand_level?.toString() || null);
            setOverrideMeasurement(data.ingredient.override_measurement_level?.toString() || null);
            setOverridePrep(data.ingredient.override_prep_level?.toString() || null);
            setHideFromSearch(data.ingredient.hide_from_search === true);

            if (data.ingredient.item_categories) {
                setSelectedCategories(data.ingredient.item_categories.map((ic: any) => ic.category_id));
            }

            if (data.ingredient.item_images) {
                const sortedImages = [...data.ingredient.item_images].sort(
                    (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
                );
                const fetchedImages = sortedImages
                    .map((ii: any) => ({
                        id: ii.images?.id,
                        url: ii.images?.url,
                        isNew: false,
                    }))
                    .filter((img: any) => img.url);
                setLocalImages(fetchedImages);
            }
        }
        if (data?.recipe) {
            setRecipeItems(sortRecipesByOrder(data.recipe).map((r) => mapPresentationRecipeToEditItem(r)));
        }
        if (data?.ingredient) setNeedsCleanMark(true);
    }, [data]);

    useEffect(() => {
        if (!needsCleanMark) return;
        cleanStateRef.current = currentStateStr;
        setNeedsCleanMark(false);
    }, [needsCleanMark, currentStateStr]);

    const addImages = (uris: string[]) => {
        if (!uris.length) return;
        setLocalImages((prev) => [...prev, ...uris.map((url) => ({ url, isNew: true }))]);
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "We need access to your photos.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });

        if (!result.canceled) {
            addImages(result.assets.map((asset) => asset.uri));
        }
    };

    const uploadAndLinkImage = async (uri: string): Promise<string | null> => {
        try {
            const ext = imageExtFromUri(uri);
            const fileName = `ingredients/${id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            const base64 = await uriToBase64(uri);
            const arrayBuffer = decode(base64);

            const { error: uploadError } = await supabase.storage.from("drinks").upload(fileName, arrayBuffer, {
                contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
                upsert: false,
            });

            if (uploadError) return null;

            const { data: publicUrlData } = supabase.storage.from("drinks").getPublicUrl(fileName);

            const { data: imgData, error: imgError } = await supabase
                .from("images")
                .insert({ url: publicUrlData.publicUrl })
                .select()
                .single();

            if (imgError || !imgData) return null;

            return imgData.id;
        } catch (error) {
            console.error("Image upload flow exception:", error);
            return null;
        }
    };

    const handleClose = () => {
        setShowPhotoSheet(false);
        if (onClose) onClose();
        else router.back();
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return false;
        }
        setSaving(true);
        try {
            const finalImageIds: string[] = [];
            for (const img of localImages) {
                if (img.isNew) {
                    const newId = await uploadAndLinkImage(img.url);
                    if (!newId) throw new Error("Failed to upload image");
                    finalImageIds.push(newId);
                } else if (img.id) {
                    finalImageIds.push(img.id);
                }
            }

            const { error: deleteImagesError } = await supabase.from("item_images").delete().eq("item_id", id);
            if (deleteImagesError) throw deleteImagesError;

            if (finalImageIds.length > 0) {
                const imageInserts = finalImageIds.map((imgId, index) => ({
                    item_id: id,
                    image_id: imgId,
                    sort_order: index,
                }));
                const { error: insertError } = await supabase.from("item_images").insert(imageInserts);
                if (insertError) throw insertError;
            }

            const { error: updateError } = await supabase
                .from("items")
                .update({
                    name: capitalize(name),
                    description: description.trim() || null,
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
            await queryClient.invalidateQueries({ queryKey: ["dropdowns_v2"] });

            cleanStateRef.current = currentStateStr;
            setShowPhotoSheet(false);

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

    const images = localImages.map((img) => img.url);

    return (
        <BottomSheetModalProvider>
            {!isInline && <Stack.Screen options={{ headerShown: false, presentation: "modal" }} />}

            <ItemDetailLayout
                id={id as string}
                title={name}
                images={images}
                emptyPhotoPlaceholder={images.length === 0}
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
                    placeholder: "Ingredient name",
                }}
                onManageImages={
                    Platform.OS === "web" && images.length === 0
                        ? () => {
                              void pickImage();
                          }
                        : () => setShowPhotoSheet(true)
                }
                onDropImages={addImages}
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
                        {recipeItems.length === 0 && (
                            <Text color="$color11" fontSize={14} fontStyle="italic">
                                Add ingredients if this is a pre-batched item. Leave empty for raw ingredients.
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

            <AdaptiveSheetModal
                visible={showPhotoSheet}
                onClose={() => setShowPhotoSheet(false)}
                title="Photos"
            >
                <View style={{ paddingHorizontal: 24 }}>
                    <SortableImageList
                        images={localImages}
                        onReorder={setLocalImages}
                        onRemove={(index) => {
                            setLocalImages(localImages.filter((_, i) => i !== index));
                        }}
                        onAdd={pickImage}
                        onAddUris={addImages}
                        generateComponent={<GenerateImageButton type="ingredient" id={id} name={name} variant="tile" />}
                    />
                </View>
            </AdaptiveSheetModal>

            <IngredientPickerSheet
                visible={showIngredientPicker}
                onClose={() => setShowIngredientPicker(false)}
                ingredients={pickerIngredients}
                excludeId={id}
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
