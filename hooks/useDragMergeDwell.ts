import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

/** Confirm dialog is the accident net; dwell only needs to feel intentional. */
export const MERGE_DWELL_MS = 700;

/**
 * iOS-home-screen-style merge arming for react-native-draggable-flatlist:
 * hold a stable placeholder index → arm merge; onDragEnd uses merge instead of reorder.
 */
export function useDragMergeDwell(enabled: boolean) {
    const fromRef = useRef<number | null>(null);
    const hoverRef = useRef<number | null>(null);
    const pendingRef = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const armedTargetRef = useRef<number | null>(null);
    const [mergeTargetIndex, setMergeTargetIndex] = useState<number | null>(null);
    const [pendingTargetIndex, setPendingTargetIndex] = useState<number | null>(null);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const disarm = useCallback(() => {
        clearTimer();
        armedTargetRef.current = null;
        pendingRef.current = null;
        setMergeTargetIndex(null);
        setPendingTargetIndex(null);
    }, []);

    const onDragBegin = useCallback(
        (index: number) => {
            if (!enabled) return;
            fromRef.current = index;
            hoverRef.current = index;
            disarm();
        },
        [enabled, disarm]
    );

    const onPlaceholderIndexChange = useCallback(
        (placeholderIndex: number) => {
            if (!enabled || fromRef.current === null) return;

            // Live reorder flickers placeholder back to `from` at row edges —
            // ignore those so the dwell can finish (and stay armed).
            if (placeholderIndex === fromRef.current) return;

            hoverRef.current = placeholderIndex;

            if (armedTargetRef.current === placeholderIndex) return;
            // Same hover target — keep the in-flight timer.
            if (pendingRef.current === placeholderIndex) return;

            if (armedTargetRef.current !== null) {
                armedTargetRef.current = null;
                setMergeTargetIndex(null);
            }
            clearTimer();
            pendingRef.current = placeholderIndex;
            setPendingTargetIndex(placeholderIndex);
            timerRef.current = setTimeout(() => {
                if (hoverRef.current !== placeholderIndex) return;
                if (fromRef.current === null || placeholderIndex === fromRef.current) return;
                armedTargetRef.current = placeholderIndex;
                setMergeTargetIndex(placeholderIndex);
                if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
            }, MERGE_DWELL_MS);
        },
        [enabled]
    );

    const consumeMergeOnDragEnd = useCallback(
        (from: number): { from: number; target: number } | null => {
            if (!enabled) {
                disarm();
                fromRef.current = null;
                return null;
            }
            const target = armedTargetRef.current;
            disarm();
            fromRef.current = null;
            // Trust armed dwell target over release index (`to` can drift)
            if (target === null || target === from) return null;
            return { from, target };
        },
        [enabled, disarm]
    );

    return {
        mergeTargetIndex,
        pendingTargetIndex,
        onDragBegin,
        onPlaceholderIndexChange,
        consumeMergeOnDragEnd,
    };
}
