import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import type { SortableRecipeItem } from '@/components/recipe/SortableRecipeList';
import {
    executeRecipeMerge,
    fetchBatchIngredientIds,
    makeIsBatchIngredient,
} from '@/lib/executeRecipeMerge';

type SaveDraftFn = (args: {
    id?: string;
    entityType: string;
    draftData: any;
}) => Promise<any>;

/**
 * Batch detection + merge executor for recipe lists.
 * persistence: 'draft' creates/updates ingredient drafts; 'published' writes items/recipes.
 */
export function useRecipeMergeHandler(opts: {
    items: SortableRecipeItem[];
    setItems: (items: SortableRecipeItem[]) => void;
    persistence: 'draft' | 'published';
    barId?: string | null;
    drafts?: any[];
    saveDraft?: SaveDraftFn;
    enabled?: boolean;
}) {
    const { items, setItems, persistence, barId, drafts, saveDraft, enabled = true } = opts;
    const [knownBatchIds, setKnownBatchIds] = useState<Set<string>>(() => new Set());
    const [merging, setMerging] = useState(false);

    const ingredientIdsKey = items.map((i) => i.ingredient_id).join(',');

    useEffect(() => {
        if (!enabled) return;
        const ids = ingredientIdsKey.split(',').filter(Boolean);
        if (ids.length === 0) return;
        let cancelled = false;
        fetchBatchIngredientIds(ids)
            .then((found) => {
                if (cancelled || found.size === 0) return;
                setKnownBatchIds((prev) => {
                    const next = new Set(prev);
                    found.forEach((id) => next.add(id));
                    return next;
                });
            })
            .catch(() => {
                // ponytail: batch lookup best-effort; drafts + known ids still work
            });
        return () => {
            cancelled = true;
        };
    }, [enabled, ingredientIdsKey]);

    const isBatchIngredient = useMemo(
        () => makeIsBatchIngredient(drafts, knownBatchIds),
        [drafts, knownBatchIds]
    );

    const onMerge = useCallback(
        async (fromIndex: number, targetIndex: number) => {
            if (!enabled || merging) return;
            setMerging(true);
            try {
                const result = await executeRecipeMerge({
                    items,
                    fromIndex,
                    targetIndex,
                    isBatch: isBatchIngredient,
                    persistence,
                    barId,
                    drafts,
                    saveDraft,
                });
                if (!result) return;
                if (result.newBatchId) {
                    setKnownBatchIds((prev) => new Set(prev).add(result.newBatchId!));
                }
                setItems(result.nextItems);
            } catch (e: any) {
                const msg = e?.message || 'Failed to combine ingredients.';
                if (Platform.OS === 'web') window.alert(msg);
                else Alert.alert('Error', msg);
            } finally {
                setMerging(false);
            }
        },
        [
            enabled,
            merging,
            items,
            isBatchIngredient,
            persistence,
            barId,
            drafts,
            saveDraft,
            setItems,
        ]
    );

    return {
        onMerge: enabled ? onMerge : undefined,
    };
}
