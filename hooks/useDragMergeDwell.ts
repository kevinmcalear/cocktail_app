import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/** Long enough to feel meant, short enough not to wait: then the row lights up "Drop to batch". */
export const MERGE_DWELL_MS = 700;

/**
 * iOS-home-screen-style drop-to-merge for a dragged row: hold it over another
 * (`hover` with that row's index, lib/dropIndex overIndex) for the dwell and
 * the merge arms; moving off (`hover(null)`) disarms it. `release` says
 * which row it was dropped on, or null for a plain reorder.
 */
export function useDragMergeDwell(enabled: boolean) {
  const hoverRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedRef = useRef<number | null>(null);
  const [mergeTargetIndex, setMergeTargetIndex] = useState<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => clearTimer, []);

  const hover = useCallback(
    (index: number | null) => {
      if (!enabled || index === hoverRef.current) return;
      hoverRef.current = index;
      clearTimer();
      if (armedRef.current !== null) {
        armedRef.current = null;
        setMergeTargetIndex(null);
      }
      if (index === null) return;
      timerRef.current = setTimeout(() => {
        if (hoverRef.current !== index) return;
        armedRef.current = index;
        setMergeTargetIndex(index);
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, MERGE_DWELL_MS);
    },
    [enabled]
  );

  /** The drag is over: the armed row to drop on, or null. Always disarms. */
  const release = useCallback((): number | null => {
    const target = armedRef.current;
    clearTimer();
    hoverRef.current = null;
    armedRef.current = null;
    setMergeTargetIndex(null);
    return enabled ? target : null;
  }, [enabled]);

  return { mergeTargetIndex, hover, release };
}
