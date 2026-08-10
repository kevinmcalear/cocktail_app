import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { supportsNestableDrag } from '@/components/recipe/FormScrollContainer';
import { UnitPicker } from '@/components/recipe/UnitPicker';
import { useDragMergeDwell } from '@/hooks/useDragMergeDwell';
import { calculateDraftProgress } from '@/lib/draftProgress';
import { isDefaultBatchName } from '@/lib/mergeRecipeItems';
import { capitalize } from '@/lib/stringUtils';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, {
    NestableDraggableFlatList,
    RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Input, Text, XStack, useTheme } from 'tamagui';

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
    /** Persist ingredient entity rename (draft or published). */
    onRenameIngredient?: (ingredientId: string, name: string) => void;
    drafts?: any[];
    dropdowns?: any;
    allIngredients?: any[];
    ingredientImageMap?: Record<string, string>;
    /** Hold over a row while dragging to combine into a complex ingredient. Return false to fall back to reorder. */
    onMerge?: (fromIndex: number, targetIndex: number) => boolean | void | Promise<boolean | void>;
}

interface DetailRecipeRowProps {
    item: SortableRecipeItem;
    index: number;
    imageUrl?: string;
    drag: () => void;
    isActive: boolean;
    isMergeTarget?: boolean;
    isMergePending?: boolean;
    autoFocusKey?: number;
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
    isMergeTarget,
    isMergePending,
    autoFocusKey,
    onUpdateItem,
    onRemove,
    nameNode,
}: DetailRecipeRowProps) {
    const theme = useTheme();
    const defaultUnit = useSettingsStore((s) => s.defaultUnit);
    const [editingMeasure, setEditingMeasure] = useState(!!autoFocusKey);
    const unitPickerOpenRef = useRef(false);
    const measurement = [item.amount, item.unit || defaultUnit].filter(Boolean).join(' ');

    useEffect(() => {
        if (!autoFocusKey) return;
        setEditingMeasure(true);
    }, [autoFocusKey]);

    return (
        <View
            style={[
                styles.detailRow,
                isActive && styles.activeItem,
                isMergePending && !isMergeTarget && styles.mergePending,
                isMergeTarget && styles.mergeTarget,
            ]}
        >
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
                    <Image source={{ uri: imageUrl }} style={styles.detailImage} contentFit="cover" />
                ) : (
                    <View style={[styles.detailImagePlaceholder, { borderColor: theme.color11?.get() as string }]}>
                        <IconSymbol name="camera.fill" size={18} color={theme.color11?.get() as string} style={{ opacity: 0.7 }} />
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
                            onBlur={() => {
                                requestAnimationFrame(() => {
                                    if (unitPickerOpenRef.current) return;
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
                            {measurement || 'Tap to add amount'}
                        </Text>
                    </TouchableOpacity>
                )}
                {nameNode}
            </View>
            {isMergeTarget ? (
                <Text style={styles.mergeHint}>Release to combine</Text>
            ) : isMergePending ? (
                <Text style={styles.mergeHint}>Hold to combine…</Text>
            ) : null}
        </View>
    );
}

function EditableRecipeName({
    item,
    index,
    variant,
    autoFocusNameKey,
    onUpdateItem,
    onRenameIngredient,
    onOpen,
    draftBadge,
}: {
    item: SortableRecipeItem;
    index: number;
    variant: 'row' | 'card' | 'detail';
    autoFocusNameKey?: number;
    onUpdateItem: (index: number, updates: Partial<SortableRecipeItem>) => void;
    onRenameIngredient?: (ingredientId: string, name: string) => void;
    onOpen?: (ingredientId: string) => void;
    draftBadge: React.ReactNode;
}) {
    const theme = useTheme();
    const [editing, setEditing] = useState(!!autoFocusNameKey);
    const nameRef = useRef<TextInput>(null);
    const committedNameRef = useRef(item.name);

    useEffect(() => {
        if (!editing) committedNameRef.current = item.name;
    }, [item.name, editing]);

    useEffect(() => {
        if (!autoFocusNameKey) return;
        setEditing(true);
        const t = setTimeout(() => nameRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [autoFocusNameKey]);

    const commitName = () => {
        setEditing(false);
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

    const nameStyle = [
        variant === 'row' ? styles.recipeName : undefined,
        variant === 'card' ? { fontSize: 16 } : undefined,
        variant === 'detail'
            ? { fontSize: 18, fontWeight: '400' as const, color: theme.color?.get() as string }
            : undefined,
        variant === 'card' ? { color: theme.color?.get() as string } : undefined,
    ];

    if (editing) {
        return (
            <TextInput
                ref={nameRef}
                value={item.name}
                onChangeText={(v) => onUpdateItem(index, { name: v })}
                placeholder="Ingredient name"
                placeholderTextColor={theme.color11?.get() as string}
                style={[styles.nameInput, ...nameStyle]}
                returnKeyType="done"
                onSubmitEditing={commitName}
                onBlur={commitName}
                selectTextOnFocus={isDefaultBatchName(item.name)}
            />
        );
    }

    return (
        <XStack gap="$2" alignItems="center" flex={1}>
            <TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.7} style={{ flexShrink: 1, minWidth: 0 }}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={nameStyle}>
                    {capitalize(item.name)}
                </Text>
            </TouchableOpacity>
            {draftBadge}
            {onOpen ? (
                <TouchableOpacity
                    onPress={() => onOpen(item.ingredient_id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Open ingredient"
                >
                    <IconSymbol name="chevron.right" size={14} color={theme.color8?.get() as string} />
                </TouchableOpacity>
            ) : null}
        </XStack>
    );
}

export function SortableRecipeList({
    items,
    onReorder,
    onUpdateItem,
    onRemove,
    variant = 'row',
    onNestedItemPress,
    onRenameIngredient,
    drafts,
    dropdowns,
    allIngredients,
    ingredientImageMap,
    onMerge,
}: SortableRecipeListProps) {
    const theme = useTheme();
    const defaultUnit = useSettingsStore((s) => s.defaultUnit);
    const dwell = useDragMergeDwell(!!onMerge);
    const prevLenRef = useRef(items.length);
    const prevIdsRef = useRef<Set<string>>(new Set(items.map((i) => i.ingredient_id)));
    const [focusMeasure, setFocusMeasure] = useState<{ index: number; key: number } | null>(null);
    const [focusName, setFocusName] = useState<{ index: number; key: number } | null>(null);

    useEffect(() => {
        if (items.length > prevLenRef.current) {
            setFocusMeasure({ index: items.length - 1, key: Date.now() });
        }
        prevLenRef.current = items.length;
    }, [items.length]);

    useEffect(() => {
        const prev = prevIdsRef.current;
        const newBatchIndex = items.findIndex(
            (i) => isDefaultBatchName(i.name) && !prev.has(i.ingredient_id)
        );
        prevIdsRef.current = new Set(items.map((i) => i.ingredient_id));
        if (newBatchIndex >= 0) {
            setFocusName({ index: newBatchIndex, key: Date.now() });
            setFocusMeasure(null);
        }
    }, [items]);

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

    const renderName = (item: SortableRecipeItem, index: number) => (
        <EditableRecipeName
            item={item}
            index={index}
            variant={variant}
            autoFocusNameKey={focusName?.index === index ? focusName.key : undefined}
            onUpdateItem={onUpdateItem}
            onRenameIngredient={onRenameIngredient}
            onOpen={onNestedItemPress}
            draftBadge={renderDraftBadge(item.ingredient_id)}
        />
    );

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
                    isMergeTarget={dwell.mergeTargetIndex === index}
                    isMergePending={dwell.pendingTargetIndex === index}
                    autoFocusKey={focusMeasure?.index === index ? focusMeasure.key : undefined}
                    onUpdateItem={onUpdateItem}
                    onRemove={onRemove}
                    nameNode={renderName(item, index)}
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
                <UnitPicker
                    value={item.unit || defaultUnit}
                    onChange={(unit) => onUpdateItem(index, { unit })}
                    size={variant === 'card' ? 'md' : 'sm'}
                />
                <TouchableOpacity onPress={() => onRemove(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <IconSymbol name="trash" size={20} color="#ff4444" />
                </TouchableOpacity>
            </XStack>
        );

        const isMergeTarget = dwell.mergeTargetIndex === index;
        const isMergePending = dwell.pendingTargetIndex === index;
        return (
            <View
                style={[
                    variant === 'row' ? styles.recipeRow : styles.cardRow,
                    isActive && styles.activeItem,
                    isMergePending && !isMergeTarget && styles.mergePending,
                    isMergeTarget && styles.mergeTarget,
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

                <View style={styles.nameContainer}>{renderName(item, index)}</View>
                <View style={styles.recipeInputs}>{inputs}</View>
                {isMergeTarget ? (
                    <Text style={styles.mergeHint}>Release to combine</Text>
                ) : isMergePending ? (
                    <Text style={styles.mergeHint}>Hold to combine…</Text>
                ) : null}
            </View>
        );
    };

    const ListComponent = supportsNestableDrag ? NestableDraggableFlatList : DraggableFlatList;

    if (items.length === 0) return null;

    return (
        <View style={styles.container}>
            {variant !== 'detail' && (
                <Text style={styles.hint}>
                    {onMerge
                        ? Platform.OS === 'web'
                            ? 'Drag handle to reorder · Hold on an ingredient to combine'
                            : 'Long press handle to reorder · Hold on an ingredient to combine'
                        : Platform.OS === 'web'
                          ? 'Drag handle to reorder'
                          : 'Long press handle to reorder'}
                </Text>
            )}
            <ListComponent
                data={items}
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
        position: 'relative',
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
        position: 'relative',
    },
    activeItem: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: Colors.dark.tint,
        borderWidth: 1,
    },
    mergePending: {
        borderColor: 'rgba(230,162,60,0.55)',
        borderWidth: 1.5,
        backgroundColor: 'rgba(230,162,60,0.08)',
        borderRadius: 12,
    },
    mergeTarget: {
        transform: [{ scale: 1.04 }],
        borderColor: '#e6a23c',
        borderWidth: 2,
        backgroundColor: 'rgba(230,162,60,0.18)',
        borderRadius: 12,
    },
    mergeHint: {
        position: 'absolute',
        right: 10,
        top: 6,
        fontSize: 11,
        fontWeight: '700',
        color: '#e6a23c',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        overflow: 'hidden',
        zIndex: 2,
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
    nameInput: {
        flex: 1,
        padding: 0,
        margin: 0,
        backgroundColor: 'transparent',
        borderWidth: 0,
        minWidth: 0,
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
        position: 'relative',
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
        borderWidth: 1,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
