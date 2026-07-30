import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

const DWELL_MS = 450;

/**
 * iOS-home-screen-style merge arming for react-native-draggable-flatlist:
 * hold a stable placeholder index ~450ms → arm merge; onDragEnd uses merge instead of reorder.
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
        armedTargetRef.current = null;
        setMergeTargetIndex(null);
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
            hoverRef.current = placeholderIndex;

            if (placeholderIndex === fromRef.current) {
                disarm();
                return;
            }

            if (armedTargetRef.current === placeholderIndex) return;

            // moved to a new hover target — reset dwell
            if (armedTargetRef.current !== null) {
                armedTargetRef.current = null;
                setMergeTargetIndex(null);
            }
            clearTimer();
            timerRef.current = setTimeout(() => {
                if (hoverRef.current !== placeholderIndex) return;
                if (fromRef.current === null || placeholderIndex === fromRef.current) return;
                armedTargetRef.current = placeholderIndex;
                setMergeTargetIndex(placeholderIndex);
                if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
            }, DWELL_MS);
        },
        [enabled, disarm]
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
        onDragBegin,
        onPlaceholderIndexChange,
        consumeMergeOnDragEnd,
    };
}
