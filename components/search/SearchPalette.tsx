import { lazy, Suspense } from 'react';

import { useSearchPalette } from '@/store/useSearchPalette';

// Loaded on the first ⌘K, so the search UI isn't part of every page's first load.
const SearchPaletteCard = lazy(() => import('./SearchPaletteCard'));

/**
 * ⌘K on wide web: the one search as a card over the page you're on, which
 * stays put behind it. Opening a result (a new page) or Escape closes it.
 */
export function SearchPalette() {
  const open = useSearchPalette((s) => s.open);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <SearchPaletteCard />
    </Suspense>
  );
}
