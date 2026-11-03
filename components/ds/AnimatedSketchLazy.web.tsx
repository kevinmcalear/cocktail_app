import { lazy, Suspense } from 'react';

import { useIsHydrated } from '@/hooks/useIsHydrated';

import type { AnimatedSketchProps } from './AnimatedSketch';
import { SceneSvg } from './SketchDrawing';
import { PAPER } from './useScene';

const Lazy = lazy(() => import('./AnimatedSketch').then((m) => ({ default: m.AnimatedSketch })));

/**
 * On the web the animated drawing (and the Reanimated it runs on) loads when
 * one is first shown, not with every page: it draws itself from blank paper
 * anyway, so blank paper is what shows while it loads (no card: the drawing
 * has none). The static export renders it too: a lazy component can't
 * finish on the server.
 */
export function AnimatedSketch(props: AnimatedSketchProps) {
  const hydrated = useIsHydrated();
  if (!hydrated) return <SceneSvg scene={PAPER} bare />;
  return (
    <Suspense fallback={<SceneSvg scene={PAPER} bare />}>
      <Lazy {...props} />
    </Suspense>
  );
}
