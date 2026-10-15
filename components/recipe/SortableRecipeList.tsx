import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';

import { Tag } from '@/components/ds';
import { gripOnly } from '@/components/recipe/FormScrollContainer';
import { RECIPE_GRIP, RecipeRow } from '@/components/recipe/RecipeRow';
import { useDragMergeDwell } from '@/hooks/useDragMergeDwell';
import { calculateDraftProgress } from '@/lib/draftProgress';
import { isDefaultBatchName } from '@/lib/mergeRecipeItems';

export interface SortableRecipeItem {
  id?: string;
  ingredient_id: string;
  name: string;
  amount: string;
  unit: string;
  preparation_notes?: string;
  is_optional?: boolean;
}

type Drafts = Parameters<typeof calculateDraftProgress>[1];

interface SortableRecipeListProps {
  items: SortableRecipeItem[];
  onReorder: (items: SortableRecipeItem[]) => void;
  onUpdateItem: (index: number, updates: Partial<SortableRecipeItem>) => void;
  onRemove: (index: number) => void;
  onNestedItemPress?: (ingredientId: string) => void;
  /** Persist ingredient entity rename (draft or published). */
  onRenameIngredient?: (ingredientId: string, name: string) => void;
  drafts?: Drafts;
  dropdowns?: Parameters<typeof calculateDraftProgress>[2];
  /** Hold over a row while dragging to combine into a complex ingredient. Return false to fall back to reorder. */
  onMerge?: (fromIndex: number, targetIndex: number) => boolean | void | Promise<boolean | void>;
}

/**
 * A prep's recipe on the ingredient add and edit pages: RecipeRow lines,
 * dragged by their grips to reorder, or held over another line to combine
 * the two (onMerge). A new line focuses its amount; a new batch line, its name.
 */
export function SortableRecipeList({ items, onReorder, onUpdateItem, onRemove, onNestedItemPress, onRenameIngredient, drafts, dropdowns, onMerge }: SortableRecipeListProps) {
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
    const newBatchIndex = items.findIndex((i) => isDefaultBatchName(i.name) && !prev.has(i.ingredient_id));
    prevIdsRef.current = new Set(items.map((i) => i.ingredient_id));
    if (newBatchIndex >= 0) {
      setFocusName({ index: newBatchIndex, key: Date.now() });
      setFocusMeasure(null);
    }
  }, [items]);

  // A line that is still someone's draft says how far along it is.
  const draftBadge = (ingredientId: string) => {
    if (!drafts || !dropdowns) return null;
    const childDraft = drafts.find((d) => d.id === ingredientId && d.entity_type === 'ingredient');
    if (!childDraft) return null;
    const progress = calculateDraftProgress(childDraft, drafts, dropdowns);
    return <Tag label={`${progress.label} (${progress.percentage}%)`} tone={progress.percentage >= 100 ? 'success' : 'outline'} />;
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<SortableRecipeItem>) => {
    const index = getIndex();
    if (index === undefined) return null;
    return (
      <RecipeRow
        item={item}
        index={index}
        drag={drag}
        isActive={isActive}
        isMergeTarget={dwell.mergeTargetIndex === index}
        isMergePending={dwell.pendingTargetIndex === index}
        autoFocusKey={focusMeasure?.index === index ? focusMeasure.key : undefined}
        autoFocusNameKey={focusName?.index === index ? focusName.key : undefined}
        onUpdateItem={onUpdateItem}
        onRemove={onRemove}
        onRenameIngredient={onRenameIngredient}
        onOpen={onNestedItemPress}
        draftBadge={draftBadge(item.ingredient_id)}
      />
    );
  };

  if (items.length === 0) return null;

  return (
    <View style={styles.list}>
      {/* Not the nestable list: these screens scroll in a plain ScrollView, where it threw. */}
      <DraggableFlatList
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
        dragHitSlop={gripOnly(RECIPE_GRIP)}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { width: '100%', overflow: 'hidden' },
});
