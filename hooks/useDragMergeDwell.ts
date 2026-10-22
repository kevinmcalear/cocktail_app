import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

/** Long enough to feel meant; a drag passing through to reorder never waits this long over one row. */
export const MERGE_DWELL_MS = 700;

/**
 * iOS-home-screen-style merge arming: hold a dragged row over another for a
 * moment and that row is armed, so letting go merges instead of reordering
 * (the add-drink lines: drop one on another to batch them). Feed it the row
 * the drag is over (lib/dropIndex overIndex), null between rows.
 */
export function useDragMergeDwell(enabled: boolean) {
    const fromRef = useRef<number | null>(null);
    const hoverRef = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const armedTargetRef = useRef<number | null>(null);
    const [mergeTargetIndex, setMergeTargetIndex] = useState<number | null>(null);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const disarm = useCallback(() => {
        clearTimer();
        hoverRef.current = null;
        armedTargetRef.current = null;
        setMergeTargetIndex(null);
    }, []);

    const onDragBegin = useCallback(
        (index: number) => {
            if (!enabled) return;
            fromRef.current = index;
            disarm();
        },
        [enabled, disarm]
    );

    const onHover = useCallback(
        (index: number | null) => {
            if (!enabled || fromRef.current === null) return;
            const target = index === fromRef.current ? null : index;
            // Same row: keep the timer running (or stay armed).
            if (target === hoverRef.current) return;
            disarm();
            if (target === null) return;
            hoverRef.current = target;
            timerRef.current = setTimeout(() => {
                if (hoverRef.current !== target) return;
                armedTargetRef.current = target;
                setMergeTargetIndex(target);
                if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
            }, MERGE_DWELL_MS);
        },
        [enabled, disarm]
    );

    const consumeMergeOnDragEnd = useCallback(
        (from: number): { from: number; target: number } | null => {
            const target = enabled ? armedTargetRef.current : null;
            disarm();
            fromRef.current = null;
            if (target === null || target === from) return null;
            return { from, target };
        },
        [enabled, disarm]
    );

    return { mergeTargetIndex, onDragBegin, onHover, consumeMergeOnDragEnd };
}
