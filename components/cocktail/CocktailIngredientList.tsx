import { Image } from "expo-image";
import React, { useState } from "react";
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import { Text, XStack, YStack, useTheme } from "tamagui";

import type { SortableRecipeItem } from "@/components/recipe/SortableRecipeList";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { buildIngredientImageMap } from "@/lib/recipeUtils";

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
}

function EditIngredientRow({
    item,
    index,
    imageUrl,
    drag,
    isActive,
    onUpdateItem,
    onRemove,
    onIngredientPress,
}: {
    item: SortableRecipeItem;
    index: number;
    imageUrl?: string;
    drag: () => void;
    isActive: boolean;
    onUpdateItem: (index: number, updates: Partial<SortableRecipeItem>) => void;
    onRemove: (index: number) => void;
    onIngredientPress?: (id: string) => void;
}) {
    const theme = useTheme();
    const [editingMeasure, setEditingMeasure] = useState(false);
    const measurement = [item.amount, item.unit].filter(Boolean).join(" ");
    const muted = theme.color11?.get() as string;

    return (
        <View style={[styles.row, isActive && styles.rowActive]}>
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
                                value={item.amount}
                                onChangeText={(v) => onUpdateItem(index, { amount: v })}
                                placeholder="Amount"
                                placeholderTextColor={theme.color11?.get() as string}
                                style={[styles.measureInput, { color: theme.color?.get() as string }]}
                                autoFocus
                            />
                            <TextInput
                                value={item.unit}
                                onChangeText={(v) => onUpdateItem(index, { unit: v })}
                                placeholder="Unit"
                                placeholderTextColor={theme.color11?.get() as string}
                                style={[styles.measureInput, { color: theme.color?.get() as string }]}
                                onBlur={() => setEditingMeasure(false)}
                            />
                        </XStack>
                    ) : (
                        <TouchableOpacity onPress={() => setEditingMeasure(true)} activeOpacity={0.7}>
                            <Text color="$color" fontSize={13} opacity={0.5} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                                {measurement || "Add amount"}
                            </Text>
                        </TouchableOpacity>
                    )}
                    <Text color="$color" fontSize={18} fontWeight="400">
                        {item.name}
                    </Text>
                </YStack>

                <TouchableOpacity
                    onPress={() => onRemove(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Remove ingredient"
                >
                    <IconSymbol name="trash" size={20} color="#ff4444" />
                </TouchableOpacity>
            </XStack>
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
    const ingredientId =
        ingredientsData?.id || recipe.display_ingredient_id || recipe.ingredient_item_id;
    const name = ingredientsData?.name || "Unknown Ingredient";

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
}: CocktailIngredientListProps) {
    const listHeight = editItems.length * EDIT_ROW_HEIGHT;

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
                    onUpdateItem={onUpdateItem}
                    onRemove={onRemove}
                    onIngredientPress={onIngredientPress}
                />
            </ScaleDecorator>
        );
    };

    if (isEditing && onReorder && onUpdateItem && onRemove) {
        return (
            <View style={{ height: listHeight, width: "100%" }}>
                <DraggableFlatList
                    data={editItems}
                    onDragEnd={({ data }) => onReorder(data)}
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
                const id =
                    recipe.ingredient?.id ||
                    recipe.ingredient_item_id ||
                    recipe.display_ingredient_id;
                return (
                    <ViewIngredientRow
                        key={recipe.id || index}
                        recipe={recipe}
                        imageUrl={id ? ingredientImageMap[id] : undefined}
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
    },
    rowActive: {
        opacity: 0.85,
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
});
