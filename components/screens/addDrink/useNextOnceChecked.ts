import { useEffect, useRef } from 'react';

/**
 * Next tapped while the name is still being checked (a beat after the last
 * key, longer on a slow connection) goes as soon as the check is back, so
 * the first tap counts. A check that finds the bar's own drink holds it for
 * the pick instead (`held`), as before.
 */
export function useNextOnceChecked(checking: boolean, held: boolean, next: () => void): () => void {
  const asked = useRef(false);
  useEffect(() => {
    if (!asked.current || checking) return;
    asked.current = false;
    if (!held) next();
  });
  return () => {
    if (checking) asked.current = true;
    else if (!held) next();
  };
}
