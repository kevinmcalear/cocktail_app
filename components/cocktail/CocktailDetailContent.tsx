import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { Accordion, Card, Paragraph, Text, TextArea, XStack, YStack, useTheme } from "tamagui";

import { BarAssignmentAccordion } from "@/components/BarAssignmentAccordion";
import { buildIngredientImageMap, CocktailIngredientList } from "@/components/cocktail/CocktailIngredientList";
import { SpecBadgeRow } from "@/components/cocktail/SpecBadgeRow";
import { IngredientPickerSheet } from "@/components/IngredientPickerSheet";
import { SortableRecipeList, type SortableRecipeItem } from "@/components/recipe/SortableRecipeList";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { useCocktailDraftEditor } from "@/hooks/useCocktailDraftEditor";
import type { useCocktailEditor } from "@/hooks/useCocktailEditor";
import { useDrafts } from "@/hooks/useDrafts";
import { useRecipeMergeHandler } from "@/hooks/useRecipeMergeHandler";
import { renameIngredientEntity } from "@/lib/drafts";
import { applyIngredientHandoff } from "@/lib/ingredientHandoff";
import { capitalize } from "@/lib/stringUtils";
import { useAppStore } from "@/store/useAppStore";
import { getPreferredUnit } from "@/store/useSettingsStore";

type Editor = ReturnType<typeof useCocktailEditor> | ReturnType<typeof useCocktailDraftEditor>;

interface CocktailDetailContentProps {
    cocktail: any;
    isEditing: boolean;
    editor?: Editor | null;
    onIngredientPress?: (ingredientId: string) => void;
    selectedIngredientId?: string | null;
    variant?: "default" | "panel";
    onNestedItemPress?: (ingredientId: string) => void;
}

export function CocktailDetailContent({
    cocktail,
    isEditing,
    editor,
    onIngredientPress,
    selectedIngredientId,
    variant = "default",
    onNestedItemPress,
}: CocktailDetailContentProps) {
    const router = useRouter();
    const theme = useTheme();
    const { drafts, saveDraft } = useDrafts();
    const { recentlyCreatedItem, setRecentlyCreatedItem } = useAppStore();
    const [notesExpanded, setNotesExpanded] = useState(false);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);

    // Targeted handoff: only the cocktail that opened create attaches the new ingredient.
    const attachSelfId =
        editor && "draftId" in editor && editor.draftId ? editor.draftId : cocktail?.id ?? null;

    useEffect(() => {
        if (!editor || recentlyCreatedItem?.type !== "ingredient") return;
        const handoff = recentlyCreatedItem;
        if (!handoff.targetId || !attachSelfId || handoff.targetId !== attachSelfId) return;
        editor.setRecipeItems(
            (prev) =>
                applyIngredientHandoff(prev, handoff, attachSelfId, {
                    amount: "",
                    unit: getPreferredUnit(),
                    preparation_notes: "",
                    is_optional: false,
                }) ?? prev
        );
        setRecentlyCreatedItem(null);
    }, [editor, recentlyCreatedItem, setRecentlyCreatedItem, attachSelfId]);

    const viewSpec = {
        method: cocktail.item_methods?.[0]?.method?.name,
        glassware: cocktail.glassware?.name,
        family: cocktail.family?.name,
        ice: cocktail.ice?.name,
        origin: cocktail.origin,
    };

    const recipes = isEditing && editor ? editor.recipeItems : cocktail.recipes || [];
    const description = isEditing && editor ? editor.description : cocktail.description;
    const notes = isEditing && editor ? editor.notes : cocktail.notes;
    const isDraftEditor = !!(editor && "persistDraft" in editor);

    const setRecipeItems = useCallback(
        (items: SortableRecipeItem[]) => {
            editor?.setRecipeItems(items);
        },
        [editor]
    );

    const { onMerge } = useRecipeMergeHandler({
        items: editor?.recipeItems ?? [],
        setItems: setRecipeItems,
        persistence: isDraftEditor ? "draft" : "published",
        barId: editor?.barId,
        drafts,
        saveDraft,
        enabled: isEditing && !!editor,
        parentName: editor?.name,
    });

    const ingredientImageMap = useMemo(
        () => buildIngredientImageMap(cocktail.recipes, editor?.allIngredients),
        [cocktail.recipes, editor?.allIngredients]
    );

    const navigateIngredient = (ingredientId: string) => {
        if (onNestedItemPress) {
            onNestedItemPress(ingredientId);
        } else if (onIngredientPress) {
            onIngredientPress(ingredientId);
        } else {
            router.push(
                isEditing
                    ? `/ingredient/${ingredientId}/edit`
                    : `/ingredient/${ingredientId}`
            );
        }
    };

    const handleRenameIngredient = useCallback(
        async (ingredientId: string, name: string) => {
            try {
                await renameIngredientEntity(ingredientId, name, drafts, saveDraft);
            } catch (e: any) {
                const msg = e?.message || "Failed to rename ingredient.";
                if (Platform.OS === "web") window.alert(msg);
                else Alert.alert("Error", msg);
            }
        },
        [drafts, saveDraft]
    );

    const renderViewIngredient = (recipe: any, index: number) => {
        const ingredientsData =
            recipe.ingredient ||
            (isEditing ? { id: recipe.ingredient_id, name: recipe.name } : null);
        const ingredientIdForImage =
            ingredientsData?.id || recipe.display_ingredient_id || recipe.ingredient_id;
        const imageUrl =
            (ingredientIdForImage && ingredientImageMap[ingredientIdForImage]) ||
            ingredientsData?.item_images?.[0]?.images?.url;
        const measurementParts = [];
        const amount = recipe.amount;
        const unit = recipe.unit;
        if (amount) measurementParts.push(`${amount}`);
        if (unit) measurementParts.push(`${unit}`);
        const measurement = measurementParts.join(" ");
        // Role-masked rows omit display_ingredient_id — don't fall back to brand id.
        const ingredientId = ingredientsData?.id || recipe.display_ingredient_id || undefined;
        const isSelected = selectedIngredientId === ingredientId;

        if (variant === "panel") {
            return (
                <TouchableOpacity
                    key={index}
                    activeOpacity={0.8}
                    onPress={() => ingredientId && navigateIngredient(ingredientId)}
                >
                    <Card
                        flexDirection="row"
                        alignItems="center"
                        padding="$3"
                        gap="$4"
                        borderWidth={1}
                        borderColor={isSelected ? "$color8" : "rgba(255,255,255,0.05)"}
                        backgroundColor={isSelected ? "rgba(0,122,255,0.08)" : "$backgroundStrong"}
                        borderRadius={12}
                    >
                        {imageUrl ? (
                            <Image
                                source={{ uri: imageUrl }}
                                style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)" }}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={styles.ingPlaceholder}>
                                <IconSymbol name="camera.fill" size={14} color={theme.color11?.get() as string} style={{ opacity: 0.7 }} />
                            </View>
                        )}
                        <YStack flex={1} gap="$0.5">
                            {measurement ? (
                                <Text color={isSelected ? "$color8" : "$color"} fontSize={11} opacity={0.6} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                                    {measurement}
                                </Text>
                            ) : null}
                            <Text color="$color" fontSize={16} fontWeight="500">
                                {ingredientsData?.name ||
                                    (recipe.display_ingredient_id ? "Unknown Ingredient" : "Hidden ingredient")}
                            </Text>
                        </YStack>
                    </Card>
                </TouchableOpacity>
            );
        }

        return (
            <XStack key={index} alignItems="center" gap="$4">
                <TouchableOpacity onPress={() => ingredientId && navigateIngredient(ingredientId)} activeOpacity={0.7}>
                    {imageUrl ? (
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.ingImage}
                            contentFit="cover"
                        />
                    ) : (
                        <View style={styles.ingImagePlaceholder}>
                            <IconSymbol name="camera.fill" size={18} color={theme.color11?.get() as string} style={{ opacity: 0.7 }} />
                        </View>
                    )}
                </TouchableOpacity>
                <YStack flex={1} gap="$0.5">
                    {measurement ? (
                        <Text color="$color" fontSize={13} opacity={0.5} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                            {measurement}
                        </Text>
                    ) : null}
                    <TouchableOpacity onPress={() => ingredientId && navigateIngredient(ingredientId)} activeOpacity={0.7}>
                        <Text color="$color" fontSize={18} fontWeight="400">
                            {ingredientsData?.name ||
                                (recipe.display_ingredient_id ? "Unknown Ingredient" : "Hidden ingredient")}
                        </Text>
                    </TouchableOpacity>
                </YStack>
            </XStack>
        );
    };

    return (
        <YStack>
            <SpecBadgeRow isEditing={isEditing} viewSpec={viewSpec} editor={editor} />

            {recipes.length > 0 || isEditing ? (
                <YStack gap={variant === "panel" ? "$2" : "$4"} marginBottom="$6" paddingHorizontal={24}>
                    {variant === "panel" && (
                        <XStack justifyContent="space-between" alignItems="center">
                            <Text fontSize={18} fontWeight="bold" color="$color">
                                Ingredients
                            </Text>
                            {isEditing && editor && (
                                <TouchableOpacity onPress={() => setShowIngredientPicker(true)}>
                                    <Text color={theme.color8?.get() as string} fontWeight="bold">
                                        + Add
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </XStack>
                    )}

                    {isEditing && editor ? (
                        variant === "panel" ? (
                            <>
                                <SortableRecipeList
                                    items={editor.recipeItems}
                                    onReorder={(items) => editor.setRecipeItems(items)}
                                    onUpdateItem={(index, updates) => {
                                        const next = [...editor.recipeItems];
                                        next[index] = { ...next[index], ...updates };
                                        editor.setRecipeItems(next);
                                    }}
                                    onRemove={(index) =>
                                        editor.setRecipeItems(editor.recipeItems.filter((_, i) => i !== index))
                                    }
                                    onMerge={onMerge}
                                    variant="card"
                                    allIngredients={editor.allIngredients}
                                    ingredientImageMap={ingredientImageMap}
                                    onNestedItemPress={onNestedItemPress}
                                    onRenameIngredient={handleRenameIngredient}
                                    drafts={drafts}
                                    dropdowns={editor.dropdowns}
                                />
                                <TouchableOpacity onPress={() => setShowIngredientPicker(true)} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                                    <Text color={theme.color8?.get() as string} fontWeight="600" fontSize={14}>
                                        + Add ingredient
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <CocktailIngredientList
                                    isEditing
                                    editItems={editor.recipeItems}
                                    ingredientImageMap={ingredientImageMap}
                                    onReorder={(items) => editor.setRecipeItems(items)}
                                    onUpdateItem={(index, updates) => {
                                        const next = [...editor.recipeItems];
                                        next[index] = { ...next[index], ...updates };
                                        editor.setRecipeItems(next);
                                    }}
                                    onRemove={(index) =>
                                        editor.setRecipeItems(editor.recipeItems.filter((_, i) => i !== index))
                                    }
                                    onMerge={onMerge}
                                    onIngredientPress={navigateIngredient}
                                    onRenameIngredient={handleRenameIngredient}
                                />
                                <TouchableOpacity onPress={() => setShowIngredientPicker(true)} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                                    <Text color={theme.color8?.get() as string} fontWeight="600" fontSize={14}>
                                        + Add ingredient
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )
                    ) : variant === "default" ? (
                        <CocktailIngredientList
                            isEditing={false}
                            viewRecipes={cocktail.recipes}
                            ingredientImageMap={ingredientImageMap}
                            onIngredientPress={navigateIngredient}
                        />
                    ) : (
                        cocktail.recipes?.map((recipe: any, index: number) => renderViewIngredient(recipe, index))
                    )}
                </YStack>
            ) : null}

            {(description || notes || isEditing) && (
                <YStack gap="$3" paddingHorizontal="$4" marginBottom="$4">
                    {(description || isEditing) && (
                        isEditing && editor ? (
                            <TextArea
                                value={editor.description}
                                onChangeText={editor.setDescription}
                                placeholder="Add a description..."
                                placeholderTextColor="$color11"
                                size="$4"
                                backgroundColor="transparent"
                                borderWidth={0}
                                color="$color"
                                fontSize={16}
                                padding={0}
                            />
                        ) : (
                            description && (
                                <Paragraph color="$color" fontSize={16} lineHeight={24}>
                                    {description}
                                </Paragraph>
                            )
                        )
                    )}

                    {(notes || isEditing) && (
                        <TouchableOpacity
                            style={[
                                styles.notesToggle,
                                {
                                    backgroundColor: theme.backgroundStrong?.get() as string,
                                    borderColor: theme.borderColor?.get() as string,
                                    borderWidth: 1,
                                },
                            ]}
                            onPress={() => !isEditing && setNotesExpanded(!notesExpanded)}
                            activeOpacity={isEditing ? 1 : 0.7}
                        >
                            <XStack alignItems="center" gap="$2">
                                <IconSymbol name="note.text" size={16} color={theme.color?.get() as string} style={{ opacity: 0.8 }} />
                                <Text color="$color" fontSize={14} fontWeight="bold" textTransform="uppercase" letterSpacing={1}>
                                    Notes
                                </Text>
                                <View style={{ flex: 1 }} />
                                {!isEditing && (
                                    <IconSymbol
                                        name={notesExpanded ? "chevron.up" : "chevron.down"}
                                        size={14}
                                        color={theme.color?.get() as string}
                                        style={{ opacity: 0.6 }}
                                    />
                                )}
                            </XStack>
                            {isEditing && editor ? (
                                <TextArea
                                    value={editor.notes}
                                    onChangeText={editor.setNotes}
                                    placeholder="Add bartender notes..."
                                    placeholderTextColor="$color11"
                                    marginTop="$3"
                                    size="$4"
                                    backgroundColor="transparent"
                                    borderWidth={0}
                                    color="$color"
                                    fontSize={16}
                                    padding={0}
                                />
                            ) : (
                                notesExpanded &&
                                notes && (
                                    <Paragraph color="$color" fontSize={16} lineHeight={24} marginTop="$3" opacity={0.9}>
                                        {notes}
                                    </Paragraph>
                                )
                            )}
                        </TouchableOpacity>
                    )}
                </YStack>
            )}

            {isEditing && editor && (
                <YStack paddingHorizontal="$4" marginBottom="$6">
                    <Accordion type="single" collapsible>
                        <Accordion.Item value="advanced">
                            <Accordion.Trigger
                                flexDirection="row"
                                justifyContent="space-between"
                                paddingVertical="$3"
                                borderWidth={0}
                                backgroundColor="transparent"
                            >
                                <Text color="$color11" fontSize={13} fontWeight="600" textTransform="uppercase" letterSpacing={1}>
                                    Advanced
                                </Text>
                                <IconSymbol name="chevron.down" size={14} color={theme.color11?.get() as string} />
                            </Accordion.Trigger>
                            <Accordion.Content paddingTop="$2">
                                <BarAssignmentAccordion
                                    barId={editor.barId}
                                    setBarId={editor.setBarId}
                                    overrideVisibility={editor.overrideVisibility}
                                    setOverrideVisibility={editor.setOverrideVisibility}
                                    overrideGeneric={editor.overrideGeneric}
                                    setOverrideGeneric={editor.setOverrideGeneric}
                                    overrideSpecific={editor.overrideSpecific}
                                    setOverrideSpecific={editor.setOverrideSpecific}
                                    overrideMeasurement={editor.overrideMeasurement}
                                    setOverrideMeasurement={editor.setOverrideMeasurement}
                                    overridePrep={editor.overridePrep}
                                    setOverridePrep={editor.setOverridePrep}
                                />
                            </Accordion.Content>
                        </Accordion.Item>
                    </Accordion>
                </YStack>
            )}

            <IngredientPickerSheet
                visible={showIngredientPicker}
                onClose={() => setShowIngredientPicker(false)}
                ingredients={editor?.allIngredients ?? []}
                drafts={drafts}
                dropdowns={editor?.dropdowns}
                onSelect={(item) => {
                    editor?.setRecipeItems([
                        ...editor.recipeItems,
                        {
                            ingredient_id: item.id,
                            name: capitalize(item.name),
                            amount: "",
                            unit: getPreferredUnit(),
                            preparation_notes: "",
                            is_optional: false,
                        },
                    ]);
                }}
                onCreate={async (query) => {
                    // ponytail: save cocktail draft before nested create so back doesn't lose the recipe
                    let parentId = attachSelfId;
                    if (isDraftEditor && editor && "persistDraft" in editor) {
                        parentId = (await editor.persistDraft(true)) || parentId;
                    }
                    router.push({
                        pathname: "/add-ingredient",
                        params: {
                            name: query,
                            barId: editor?.barId || "",
                            attachTo: parentId || "",
                        },
                    });
                }}
            />
        </YStack>
    );
}

const styles = StyleSheet.create({
    ingImage: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    ingImagePlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.05)",
        justifyContent: "center",
        alignItems: "center",
    },
    ingPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.05)",
        justifyContent: "center",
        alignItems: "center",
    },
    notesToggle: {
        padding: 16,
        borderRadius: 12,
        width: "100%",
    },
});
