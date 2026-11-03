import type { ReactNode } from 'react';

import { useBarGlassware } from '@/hooks/useBarGlassList';

import { DrawingGlassesContext } from './drawingGlasses';

/**
 * Draws every drink inside in this bar's glassware (a bar's menu, its public
 * page, its Tonight): a drink from elsewhere takes the bar's default glass of
 * its type (lib/sketch/barGlass.ts). Asks for the glasses once, for every
 * drawing below. Outside one, drinks are drawn as stored.
 */
export function DrawingBar({ barId, children }: { barId: string | null | undefined; children: ReactNode }) {
  const glasses = useBarGlassware(barId).data ?? null;
  return <DrawingGlassesContext value={glasses}>{children}</DrawingGlassesContext>;
}
