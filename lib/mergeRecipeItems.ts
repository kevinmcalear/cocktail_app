import type { SortableRecipeItem } from '@/components/recipe/SortableRecipeList';

export const NEW_BATCH_NAME = 'New batch';

/** "{Cocktail} batch", or "New batch" when the parent has no name yet. */
export function defaultBatchName(parentName?: string | null): string {
    const base = parentName?.trim();
    return base ? `${base} batch` : NEW_BATCH_NAME;
}

/** Fresh merge defaults: "New batch" or anything ending in " batch". */
export function isDefaultBatchName(name: string): boolean {
    return name === NEW_BATCH_NAME || (name.length > 6 && name.endsWith(' batch'));
}

export type MergePlan =
    | {
          mode: 'create';
          childItems: SortableRecipeItem[];
      }
    | {
          mode: 'append';
          batchIngredientId: string;
          appendItem: SortableRecipeItem;
          nextParentItems: SortableRecipeItem[];
      };

/** Strip parent recipe-row id so children become new lines on the batch. */
function asChildLine(item: SortableRecipeItem): SortableRecipeItem {
    return {
        ingredient_id: item.ingredient_id,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        preparation_notes: item.preparation_notes,
        is_optional: item.is_optional,
    };
}

/**
 * Plan a drag-merge. Indices are in the pre-drag parent list.
 * If either line is a batch, that batch survives and the other is appended into it
 * (target preferred when both are batches). Otherwise create a new batch from both.
 */
export function planMerge(
    items: SortableRecipeItem[],
    fromIndex: number,
    targetIndex: number,
    isBatch: (ingredientId: string) => boolean
): MergePlan | null {
    if (
        fromIndex === targetIndex ||
        fromIndex < 0 ||
        targetIndex < 0 ||
        fromIndex >= items.length ||
        targetIndex >= items.length
    ) {
        return null;
    }

    const dragged = items[fromIndex];
    const target = items[targetIndex];
    const targetIsBatch = isBatch(target.ingredient_id);
    const draggedIsBatch = isBatch(dragged.ingredient_id);

    if (targetIsBatch || draggedIsBatch) {
        const survivorIndex = targetIsBatch ? targetIndex : fromIndex;
        const removedIndex = survivorIndex === targetIndex ? fromIndex : targetIndex;
        return {
            mode: 'append',
            batchIngredientId: items[survivorIndex].ingredient_id,
            appendItem: asChildLine(items[removedIndex]),
            nextParentItems: items.filter((_, i) => i !== removedIndex),
        };
    }

    const first = fromIndex < targetIndex ? dragged : target;
    const second = fromIndex < targetIndex ? target : dragged;
    return {
        mode: 'create',
        childItems: [asChildLine(first), asChildLine(second)],
    };
}

export function applyCreateToParent(
    items: SortableRecipeItem[],
    fromIndex: number,
    targetIndex: number,
    batchLine: SortableRecipeItem
): SortableRecipeItem[] {
    const insertAt = Math.min(fromIndex, targetIndex);
    const next = items.filter((_, i) => i !== fromIndex && i !== targetIndex);
    next.splice(insertAt, 0, batchLine);
    return next;
}
