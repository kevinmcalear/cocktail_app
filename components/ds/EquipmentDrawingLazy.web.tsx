import { lazy, memo, Suspense, type ComponentProps, type ComponentType } from 'react';

import { useIsHydrated } from '@/hooks/useIsHydrated';

import type { EquipmentDrawing as Drawing } from './EquipmentDrawing';
import { SceneSvg } from './SketchDrawing';
import { PAPER } from './useScene';

// A chunk that fails to load (offline, or a deploy changed its name) leaves the paper: the drawing is decorative.
type Props = ComponentProps<typeof Drawing>;
const Paper = ({ bare }: Props) => <SceneSvg scene={PAPER} bare={bare} />;
const Lazy = lazy<ComponentType<Props>>(() => preloadEquipmentDrawing().then((m) => ({ default: m.EquipmentDrawing }), () => ({ default: Paper })));

/** Starts loading the painter: a kit page calls it as its code loads, so its picture is ready by the first paint after hydration. */
export function preloadEquipmentDrawing() {
  return import('./EquipmentDrawing');
}

/**
 * On the web the kit painter (lib/sketch/kit, about 40 KB) loads when the first
 * piece of kit is drawn, not with every page (a kit page, EquipmentBody, starts
 * it as soon as its own code loads). Blank house paper shows
 * meanwhile, as a lazy thumb does before it paints, and in the static export
 * (a lazy component can't finish on the server).
 */
export const EquipmentDrawing = memo(function EquipmentDrawing(props: Props) {
  const hydrated = useIsHydrated();
  const paper = <Paper {...props} />;
  if (!hydrated) return paper;
  return (
    <Suspense fallback={paper}>
      <Lazy {...props} />
    </Suspense>
  );
});
