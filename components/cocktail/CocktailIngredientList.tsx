import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import { Text, XStack, YStack, useTheme } from "tamagui";

import type { SortableRecipeItem } from "@/components/recipe/SortableRecipeList";
import { UnitPicker } from "@/components/recipe/UnitPicker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useDragMergeDwell } from "@/hooks/useDragMergeDwell";
import { isDefaultBatchName } from "@/lib/mergeRecipeItems";
import { buildIngredientImageMap } from "@/lib/recipeUtils";
import { capitalize } from "@/lib/stringUtils";
import { useSettingsStore } from "@/store/useSettingsStore";

export { buildIngredientImageMap };

const EDIT_ROW_HEIGHT = 80;

interface CocktailIngredientListProps {
    isEditing: boolean;
    viewRecipes?: any[];
    editItems?: SortableRecipeItem[];
    ingredientImageMap: Record<string, string>;
    onReorder?: (items: SortableRecipeItem[]) => void;
    onUpdateItem?: (index: number, updates: Partial<SortableRecipeItem>) => void;
    onRemove?: (index: number) => void;
    onIngredientPress?: (ingredientId: string) => void;
    /** Persist ingredient entity rename (draft or published). */
    onRenameIngredient?: (ingredientId: string, name: string) => void;
    onMerge?: (fromIndex: number, targetIndex: number) => boolean | void | Promise<boolean | void>;
}

function EditIngredientRow({
    item,
    index,
    imageUrl,
    drag,
    isActive,
    isMergeTarget,
    isMergePending,
    autoFocusKey,
    autoFocusNameKey,
    onUpdateItem,
    onRemove,
    onIngredientPress,
    onRenameIngredient,
}: {
    item: SortableRecipeItem;
    index: number;
    imageUrl?: string;
    drag: () => void;
    isActive: boolean;
    isMergeTarget?: boolean;
    isMergePending?: boolean;
    /** Bumps when this row was just added — opens amount and autofocuses. */
    autoFocusKey?: number;
    /** Bumps when a merge created this batch — opens name and autofocuses. */
    autoFocusNameKey?: number;
    onUpdateItem: (index: number, updates: Partial<SortableRecipeItem>) => void;
    onRemove: (index: number) => void;
    onIngredientPress?: (id: string) => void;
    onRenameIngredient?: (ingredientId: string, name: string) => void;
}) {
    const theme = useTheme();
    const defaultUnit = useSettingsStore((s) => s.defaultUnit);
    const [editingMeasure, setEditingMeasure] = useState(!!autoFocusKey);
    const [editingName, setEditingName] = useState(!!autoFocusNameKey);
    const unitPickerOpenRef = useRef(false);
    const amountRef = useRef<TextInput>(null);
    const nameRef = useRef<TextInput>(null);
    const committedNameRef = useRef(item.name);
    const measurement = [item.amount, item.unit || defaultUnit].filter(Boolean).join(" ");
    const muted = theme.color11?.get() as string;

    useEffect(() => {
        if (!editingName) committedNameRef.current = item.name;
    }, [item.name, editingName]);

    // Open amount after add; delay focus so the ingredient picker sheet doesn't steal it.
    useEffect(() => {
        if (!autoFocusKey) return;
        setEditingMeasure(true);
        const t = setTimeout(() => amountRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [autoFocusKey]);

    // Open name after drag-merge creates "New batch".
    useEffect(() => {
        if (!autoFocusNameKey) return;
        setEditingName(true);
        const t = setTimeout(() => nameRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [autoFocusNameKey]);

    const commitName = () => {
        setEditingName(false);
        const next = capitalize(item.name.trim());
        if (!next) {
            onUpdateItem(index, { name: committedNameRef.current });
            return;
        }
        if (next !== item.name) onUpdateItem(index, { name: next });
        if (next !== committedNameRef.current) {
            committedNameRef.current = next;
            onRenameIngredient?.(item.ingredient_id, next);
        }
    };

    return (
        <View
            style={[
                styles.row,
                isActive && styles.rowActive,
                isMergePending && !isMergeTarget && styles.mergePending,
                isMergeTarget && styles.mergeTarget,
            ]}
        >
            <XStack alignItems="center" gap="$4" width="100%">
                <View style={styles.imageCol}>
                    <TouchableOpacity
                        onLongPress={Platform.OS === "web" ? undefined : drag}
                        onPressIn={Platform.OS === "web" ? drag : undefined}
                        disabled={isActive}
                        style={[styles.grabber, Platform.OS === "web" && styles.grabberWeb]}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        accessibilityLabel="Drag to reorder"
                    >
                        <IconSymbol name="line.3.horizontal" size={12} color={muted} style={{ opacity: 0.45 }} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onIngredientPress?.(item.ingredient_id)}
                        activeOpacity={0.7}
                        accessibilityLabel={imageUrl ? "Open ingredient" : "Add ingredient photo"}
                    >
                        {imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
                        ) : (
                            <View style={[styles.imagePlaceholder, { borderColor: muted }]}>
                                <IconSymbol name="camera.fill" size={18} color={muted} style={{ opacity: 0.7 }} />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <YStack flex={1} gap="$0.5" minWidth={0}>
                    {editingMeasure ? (
                        <XStack gap="$2" alignItems="center" flexWrap="wrap">
                            <TextInput
                                ref={amountRef}
                                value={item.amount}
                                onChangeText={(v) => onUpdateItem(index, { amount: v })}
                                placeholder="Amount"
                                placeholderTextColor={theme.color11?.get() as string}
                                style={[styles.measureInput, { color: theme.color?.get() as string }]}
                                autoFocus
                                keyboardType="numeric"
                                returnKeyType="done"
                                onSubmitEditing={() => setEditingMeasure(false)}
                                onBlur={() => {
                                    // Defer so unit-sheet open / re-focus don't collapse the fields.
                                    requestAnimationFrame(() => {
                                        if (amountRef.current?.isFocused() || unitPickerOpenRef.current) return;
                                        setEditingMeasure(false);
                                    });
                                }}
                            />
                            <UnitPicker
                                value={item.unit || defaultUnit}
                                onChange={(unit) => onUpdateItem(index, { unit })}
                                onOpenChange={(open) => {
                                    unitPickerOpenRef.current = open;
                                }}
                            />
                        </XStack>
                    ) : (
                        <TouchableOpacity onPress={() => setEditingMeasure(true)} activeOpacity={0.7}>
                            <Text color="$color" fontSize={13} opacity={0.5} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                                {measurement || "Add amount"}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {editingName ? (
                        <TextInput
                            ref={nameRef}
                            value={item.name}
                            onChangeText={(v) => onUpdateItem(index, { name: v })}
                            placeholder="Ingredient name"
                            placeholderTextColor={theme.color11?.get() as string}
                            style={[styles.nameInput, { color: theme.color?.get() as string }]}
                            returnKeyType="done"
                            onSubmitEditing={commitName}
                            onBlur={commitName}
                            selectTextOnFocus={isDefaultBatchName(item.name)}
                        />
                    ) : (
                        <TouchableOpacity onPress={() => setEditingName(true)} activeOpacity={0.7}>
                            <Text color="$color" fontSize={18} fontWeight="400">
                                {item.name}
                            </Text>
                        </TouchableOpacity>
                    )}
                </YStack>

                <TouchableOpacity
                    onPress={() => onRemove(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Remove ingredient"
                >
                    <IconSymbol name="trash" size={20} color="#ff4444" />
                </TouchableOpacity>
            </XStack>
            {isMergeTarget ? (
                <Text style={styles.mergeHint}>Release to combine</Text>
            ) : isMergePending ? (
                <Text style={styles.mergeHint}>Hold to combine…</Text>
            ) : null}
        </View>
    );
}

function ViewIngredientRow({
    recipe,
    imageUrl,
    onIngredientPress,
}: {
    recipe: any;
    imageUrl?: string;
    onIngredientPress?: (id: string) => void;
}) {
    const theme = useTheme();
    const ingredientsData = recipe.ingredient;
    const measurementParts = [];
    if (recipe.amount) measurementParts.push(`${recipe.amount}`);
    if (recipe.unit) measurementParts.push(`${recipe.unit}`);
    const measurement = measurementParts.join(" ");
    // Don't fall back to ingredient_item_id — that's the brand id even when role-masked.
    const ingredientId = ingredientsData?.id || recipe.display_ingredient_id || undefined;
    const name =
        ingredientsData?.name ||
        (recipe.display_ingredient_id ? "Unknown Ingredient" : "Hidden ingredient");

    return (
        <XStack alignItems="center" gap="$4">
            <TouchableOpacity
                onPress={() => ingredientId && onIngredientPress?.(ingredientId)}
                activeOpacity={0.7}
            >
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
                ) : (
                    <View style={[styles.imagePlaceholder, { borderColor: theme.color11?.get() as string }]}>
                        <IconSymbol name="camera.fill" size={18} color={theme.color11?.get() as string} style={{ opacity: 0.7 }} />
                    </View>
                )}
            </TouchableOpacity>
            <YStack flex={1} gap="$0.5" minWidth={0}>
                {measurement ? (
                    <Text color="$color" fontSize={13} opacity={0.5} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                        {measurement}
                    </Text>
                ) : null}
                <TouchableOpacity
                    onPress={() => ingredientId && onIngredientPress?.(ingredientId)}
                    activeOpacity={0.7}
                >
                    <Text color="$color" fontSize={18} fontWeight="400">
                        {name}
                    </Text>
                </TouchableOpacity>
            </YStack>
        </XStack>
    );
}

export function CocktailIngredientList({
    isEditing,
    viewRecipes,
    editItems = [],
    ingredientImageMap,
    onReorder,
    onUpdateItem,
    onRemove,
    onIngredientPress,
    onRenameIngredient,
    onMerge,
}: CocktailIngredientListProps) {
    const listHeight = editItems.length * EDIT_ROW_HEIGHT;
    const dwell = useDragMergeDwell(!!onMerge);
    const prevLenRef = useRef(editItems.length);
    const prevIdsRef = useRef<Set<string>>(new Set(editItems.map((i) => i.ingredient_id)));
    const [focusMeasure, setFocusMeasure] = useState<{ index: number; key: number } | null>(null);
    const [focusName, setFocusName] = useState<{ index: number; key: number } | null>(null);

    useEffect(() => {
        if (editItems.length > prevLenRef.current) {
            setFocusMeasure({ index: editItems.length - 1, key: Date.now() });
        }
        prevLenRef.current = editItems.length;
    }, [editItems.length]);

    // Merge creates a new default batch id (list length usually drops) — focus rename.
    useEffect(() => {
        const prev = prevIdsRef.current;
        const newBatchIndex = editItems.findIndex(
            (i) => isDefaultBatchName(i.name) && !prev.has(i.ingredient_id)
        );
        prevIdsRef.current = new Set(editItems.map((i) => i.ingredient_id));
        if (newBatchIndex >= 0) {
            setFocusName({ index: newBatchIndex, key: Date.now() });
            setFocusMeasure(null);
        }
    }, [editItems]);

    const renderEditItem = ({ item, drag, isActive, getIndex }: RenderItemParams<SortableRecipeItem>) => {
        const index = getIndex();
        if (index === undefined || !onUpdateItem || !onRemove) return null;

        return (
            <ScaleDecorator>
                <EditIngredientRow
                    item={item}
                    index={index}
                    imageUrl={ingredientImageMap[item.ingredient_id]}
                    drag={drag}
                    isActive={isActive}
                    isMergeTarget={dwell.mergeTargetIndex === index}
                    isMergePending={dwell.pendingTargetIndex === index}
                    autoFocusKey={focusMeasure?.index === index ? focusMeasure.key : undefined}
                    autoFocusNameKey={focusName?.index === index ? focusName.key : undefined}
                    onUpdateItem={onUpdateItem}
                    onRemove={onRemove}
                    onIngredientPress={onIngredientPress}
                    onRenameIngredient={onRenameIngredient}
                />
            </ScaleDecorator>
        );
    };

    if (isEditing && onReorder && onUpdateItem && onRemove) {
        return (
            <View style={{ height: listHeight, width: "100%" }}>
                <DraggableFlatList
                    data={editItems}
                    onDragBegin={dwell.onDragBegin}
                    onPlaceholderIndexChange={dwell.onPlaceholderIndexChange}
                    onDragEnd={({ data, from }) => {
                        const merge = dwell.consumeMergeOnDragEnd(from);
                        if (merge && onMerge) {
                            // Cancelled combine → apply the reorder the user was aiming for
                            void Promise.resolve(onMerge(merge.from, merge.target)).then((didMerge) => {
                                if (didMerge === false) onReorder(data);
                            });
                            return;
                        }
                        onReorder(data);
                    }}
                    keyExtractor={(item, index) => item.id || `${item.ingredient_id}-${index}`}
                    renderItem={renderEditItem}
                    scrollEnabled={false}
                    style={{ height: listHeight, flexGrow: 0 }}
                    containerStyle={{ flexGrow: 0 }}
                    activationDistance={10}
                />
            </View>
        );
    }

    return (
        <YStack gap="$4">
            {viewRecipes?.map((recipe, index) => {
                const id = recipe.ingredient?.id || recipe.display_ingredient_id;
                const imageUrl =
                    (id && ingredientImageMap[id]) ||
                    recipe.ingredient?.item_images?.[0]?.images?.url ||
                    undefined;
                return (
                    <ViewIngredientRow
                        key={recipe.id || index}
                        recipe={recipe}
                        imageUrl={imageUrl}
                        onIngredientPress={onIngredientPress}
                    />
                );
            })}
        </YStack>
    );
}

const styles = StyleSheet.create({
    row: {
        width: "100%",
        height: EDIT_ROW_HEIGHT,
        justifyContent: "center",
        position: "relative",
    },
    rowActive: {
        opacity: 0.85,
    },
    mergePending: {
        borderColor: "rgba(230,162,60,0.55)",
        borderWidth: 1.5,
        backgroundColor: "rgba(230,162,60,0.08)",
        borderRadius: 12,
    },
    mergeTarget: {
        transform: [{ scale: 1.04 }],
        borderColor: "#e6a23c",
        borderWidth: 2,
        backgroundColor: "rgba(230,162,60,0.18)",
        borderRadius: 12,
    },
    mergeHint: {
        position: "absolute",
        right: 10,
        top: 6,
        fontSize: 11,
        fontWeight: "700",
        color: "#e6a23c",
        backgroundColor: "rgba(0,0,0,0.55)",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        overflow: "hidden",
        zIndex: 2,
    },
    imageCol: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
    },
    grabber: {
        width: 12,
        height: 64,
        justifyContent: "center",
        alignItems: "center",
    },
    grabberWeb: {
        cursor: "grab",
    } as object,
    image: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    imagePlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderStyle: "dashed",
        justifyContent: "center",
        alignItems: "center",
    },
    measureInput: {
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        opacity: 0.5,
        padding: 0,
        margin: 0,
        minWidth: 48,
        backgroundColor: "transparent",
        borderWidth: 0,
    },
    nameInput: {
        fontSize: 18,
        fontWeight: "400",
        padding: 0,
        margin: 0,
        backgroundColor: "transparent",
        borderWidth: 0,
    },
});
