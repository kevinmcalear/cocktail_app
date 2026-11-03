import { lazy, Suspense, type ComponentProps } from 'react';

import { useIsHydrated } from '@/hooks/useIsHydrated';

import type { EquipmentDrawing as Drawing } from './EquipmentDrawing';
import { SceneSvg } from './SketchDrawing';
import { PAPER } from './useScene';

const Lazy = lazy(() => import('./EquipmentDrawing').then((m) => ({ default: m.EquipmentDrawing })));

/**
 * On the web the kit painter (lib/sketch/kit, about 40 KB) loads when the first
 * piece of kit is drawn, not with every page. Blank house paper shows
 * meanwhile, as a lazy thumb does before it paints, and in the static export
 * (a lazy component can't finish on the server).
 */
export function EquipmentDrawing(props: ComponentProps<typeof Drawing>) {
  const hydrated = useIsHydrated();
  const paper = <SceneSvg scene={PAPER} bare={props.bare} />;
  if (!hydrated) return paper;
  return (
    <Suspense fallback={paper}>
      <Lazy {...props} />
    </Suspense>
  );
}
