import { lazy, Suspense, useEffect } from 'react';

import { useSearchPalette } from '@/store/useSearchPalette';

// Not part of every page's first load: fetched and run once the page is idle (below), so the first ⌘K opens at once.
const loadCard = () => import('./SearchPaletteCard');
const SearchPaletteCard = lazy(loadCard);

/**
 * ⌘K on wide web: the one search as a card over the page you're on, which
 * stays put behind it. Opening a result (a new page) or Escape closes it.
 */
export function SearchPalette() {
  const open = useSearchPalette((s) => s.open);
  useEffect(() => {
    // Safari has no requestIdleCallback: a moment after the page is up instead.
    if (typeof requestIdleCallback !== 'function') {
      const t = setTimeout(() => void loadCard(), 1500);
      return () => clearTimeout(t);
    }
    const id = requestIdleCallback(() => void loadCard());
    return () => cancelIdleCallback(id);
  }, []);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <SearchPaletteCard />
    </Suspense>
  );
}
