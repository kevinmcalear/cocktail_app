import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { calculateDraftProgress } from '@/lib/draftProgress';
import { capitalize } from '@/lib/stringUtils';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, {
    NestableDraggableFlatList,
    RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Input, Text, XStack, useTheme } from 'tamagui';
import { supportsNestableDrag } from '@/components/recipe/FormScrollContainer';

export interface SortableRecipeItem {
    id?: string;
    ingredient_id: string;
    name: string;
    amount: string;
    unit: string;
    preparation_notes?: string;
    is_optional?: boolean;
}

interface SortableRecipeListProps {
    items: SortableRecipeItem[];
    onReorder: (items: SortableRecipeItem[]) => void;
    onUpdateItem: (index: number, updates: Partial<SortableRecipeItem>) => void;
    onRemove: (index: number) => void;
    variant?: 'row' | 'card' | 'detail';
    onNestedItemPress?: (ingredientId: string) => void;
    drafts?: any[];
    dropdowns?: any;
    allIngredients?: any[];
    ingredientImageMap?: Record<string, string>;
}

interface DetailRecipeRowProps {
    item: SortableRecipeItem;
    index: number;
    imageUrl?: string;
    drag: () => void;
    isActive: boolean;
    onUpdateItem: (index: number, updates: Partial<SortableRecipeItem>) => void;
    onRemove: (index: number) => void;
    nameNode: React.ReactNode;
}

function DetailRecipeRow({
    item,
    index,
    imageUrl,
    drag,
    isActive,
    onUpdateItem,
    onRemove,
    nameNode,
}: DetailRecipeRowProps) {
    const theme = useTheme();
    const [editingMeasure, setEditingMeasure] = useState(false);
    const measurement = [item.amount, item.unit].filter(Boolean).join(' ');

    return (
        <View style={[styles.detailRow, isActive && styles.activeItem]}>
            <View style={styles.detailImageWrap}>
                <TouchableOpacity
                    onLongPress={Platform.OS === 'web' ? undefined : drag}
                    onPressIn={Platform.OS === 'web' ? drag : undefined}
                    disabled={isActive}
                    style={styles.detailGrabOnImage}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 4 }}
                    accessibilityLabel="Drag to reorder"
                >
                    <IconSymbol name="line.3.horizontal" size={12} color={theme.color11?.get() as string} style={{ opacity: 0.55 }} />
                </TouchableOpacity>

                {imageUrl ? (
                    <Image source={imageUrl} style={styles.detailImage} contentFit="cover" />
                ) : (
                    <View style={styles.detailImagePlaceholder}>
                        <IconSymbol name="drop.fill" size={24} color={theme.color?.get() as string} style={{ opacity: 0.2 }} />
                    </View>
                )}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
                {editingMeasure ? (
                    <XStack gap="$2" alignItems="center">
                        <Input
                            size="$2"
                            width={56}
                            placeholder="amt"
                            placeholderTextColor="$color11"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            value={item.amount}
                            onChangeText={(v) => onUpdateItem(index, { amount: v })}
                            autoFocus
                        />
                        <Input
                            size="$2"
                            width={56}
                            placeholder="unit"
                            placeholderTextColor="$color11"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            value={item.unit}
                            onChangeText={(v) => onUpdateItem(index, { unit: v })}
                            onBlur={() => setEditingMeasure(false)}
                        />
                    </XStack>
                ) : (
                    <TouchableOpacity onPress={() => setEditingMeasure(true)} activeOpacity={0.7}>
                        <Text color="$color" fontSize={13} opacity={0.5} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                            {measurement || 'Tap to add amount'}
                        </Text>
                    </TouchableOpacity>
                )}
                {nameNode}
            </View>
        </View>
    );
}

export function SortableRecipeList({
    items,
    onReorder,
    onUpdateItem,
    onRemove,
    variant = 'row',
    onNestedItemPress,
    drafts,
    dropdowns,
    allIngredients,
    ingredientImageMap,
}: SortableRecipeListProps) {
    const theme = useTheme();

    const renderDraftBadge = (ingredientId: string) => {
        if (!drafts || !dropdowns) return null;
        const childDraft = drafts.find(
            (d: any) => d.id === ingredientId && d.entity_type === 'ingredient'
        );
        if (!childDraft) return null;
        const childProgress = calculateDraftProgress(childDraft, drafts, dropdowns);
        return (
            <View
                style={[
                    styles.draftBadge,
                    {
                        backgroundColor: childProgress.badgeBg,
                        borderColor: childProgress.color,
                        borderWidth: 1,
                    },
                ]}
            >
                <Text style={[styles.draftBadgeText, { color: childProgress.badgeText }]}>
                    {childProgress.label} ({childProgress.percentage}%)
                </Text>
            </View>
        );
    };

    const renderName = (item: SortableRecipeItem) => {
        const nameText = (
            <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                    variant === 'row' ? styles.recipeName : undefined,
                    variant === 'card' ? { fontSize: 16 } : undefined,
                    variant === 'detail' ? { fontSize: 18, fontWeight: '400', color: theme.color?.get() as string } : undefined,
                    onNestedItemPress
                        ? { color: theme.color8?.get() as string }
                        : variant === 'card'
                          ? { color: theme.color?.get() as string }
                          : undefined,
                ]}
            >
                {capitalize(item.name)}
            </Text>
        );

        if (onNestedItemPress) {
            return (
                <TouchableOpacity
                    onPress={() => onNestedItemPress(item.ingredient_id)}
                    activeOpacity={0.7}
                >
                    <XStack gap="$2" alignItems="center" flex={1}>
                        {nameText}
                        {renderDraftBadge(item.ingredient_id)}
                    </XStack>
                </TouchableOpacity>
            );
        }

        return (
            <XStack gap="$2" alignItems="center" flex={1}>
                {nameText}
                {renderDraftBadge(item.ingredient_id)}
            </XStack>
        );
    };

    const renderItem = ({
        item,
        drag,
        isActive,
        getIndex,
    }: RenderItemParams<SortableRecipeItem>) => {
        const index = getIndex();
        if (index === undefined) return null;

        if (variant === 'detail') {
            const ing = allIngredients?.find((i: any) => i.id === item.ingredient_id);
            const imageUrl = ingredientImageMap?.[item.ingredient_id] || ing?.item_images?.[0]?.images?.url;
            return (
                <DetailRecipeRow
                    item={item}
                    index={index}
                    imageUrl={imageUrl}
                    drag={drag}
                    isActive={isActive}
                    onUpdateItem={onUpdateItem}
                    onRemove={onRemove}
                    nameNode={renderName(item)}
                />
            );
        }

        const inputs = (
            <XStack gap="$2" alignItems="center">
                <Input
                    size={variant === 'card' ? '$3' : '$2'}
                    width={60}
                    placeholder={variant === 'card' ? 'amt' : '1.5'}
                    placeholderTextColor="$color11"
                    keyboardType="numeric"
                    backgroundColor="$backgroundStrong"
                    borderColor="$borderColor"
                    value={item.amount}
                    onChangeText={(v) => onUpdateItem(index, { amount: v })}
                />
                <Input
                    size={variant === 'card' ? '$3' : '$2'}
                    width={60}
                    placeholder="oz"
                    placeholderTextColor="$color11"
                    backgroundColor="$backgroundStrong"
                    borderColor="$borderColor"
                    value={item.unit}
                    onChangeText={(v) => onUpdateItem(index, { unit: v })}
                />
                <TouchableOpacity onPress={() => onRemove(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <IconSymbol name="trash" size={20} color="#ff4444" />
                </TouchableOpacity>
            </XStack>
        );

        return (
            <View
                style={[
                    variant === 'row' ? styles.recipeRow : styles.cardRow,
                    isActive && styles.activeItem,
                ]}
            >
                <TouchableOpacity
                    onLongPress={Platform.OS === 'web' ? undefined : drag}
                    onPressIn={Platform.OS === 'web' ? drag : undefined}
                    disabled={isActive}
                    style={[styles.dragHandle, Platform.OS === 'web' && styles.dragHandleWeb]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Drag to reorder"
                    accessibilityRole="button"
                >
                    <IconSymbol name="line.3.horizontal" size={18} color="#aaa" />
                </TouchableOpacity>

                <View style={styles.nameContainer}>{renderName(item)}</View>
                <View style={styles.recipeInputs}>{inputs}</View>
            </View>
        );
    };

    const ListComponent = supportsNestableDrag ? NestableDraggableFlatList : DraggableFlatList;

    if (items.length === 0) return null;

    return (
        <View style={styles.container}>
            {variant !== 'detail' && (
                <Text style={styles.hint}>
                    {Platform.OS === 'web' ? 'Drag handle to reorder' : 'Long press handle to reorder'}
                </Text>
            )}
            <ListComponent
                data={items}
                onDragEnd={({ data }) => onReorder(data)}
                keyExtractor={(item, index) => item.id || `${item.ingredient_id}-${index}`}
                renderItem={renderItem}
                scrollEnabled={false}
                activationDistance={10}
                style={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 4,
        width: '100%',
        overflow: 'hidden',
    },
    hint: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
        paddingHorizontal: 2,
    },
    list: {
        width: '100%',
        overflow: 'hidden',
    },
    recipeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        padding: 10,
        borderRadius: 10,
        marginBottom: 8,
        gap: 8,
        overflow: 'hidden',
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.04)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        gap: 8,
        overflow: 'hidden',
    },
    activeItem: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: Colors.dark.tint,
        borderWidth: 1,
    },
    dragHandle: {
        flexShrink: 0,
        paddingVertical: 8,
        paddingHorizontal: 6,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    dragHandleWeb: {
        cursor: 'grab',
    } as any,
    nameContainer: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    recipeName: {
        fontSize: 16,
        flexShrink: 1,
    },
    recipeInputs: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        flexShrink: 0,
        gap: 4,
        alignItems: 'center',
    },
    draftBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    draftBadgeText: {
        fontSize: 10,
        fontWeight: '600',
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        gap: 16,
        marginBottom: 16,
    },
    detailImageWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailGrabOnImage: {
        width: 14,
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailImage: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    detailImagePlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
