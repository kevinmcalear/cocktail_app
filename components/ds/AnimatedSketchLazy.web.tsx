import { lazy, Suspense } from 'react';

import { useIsHydrated } from '@/hooks/useIsHydrated';

import type { AnimatedSketchProps } from './AnimatedSketch';
import { SceneSvg } from './SketchDrawing';
import { PAPER } from './useScene';

const Lazy = lazy(() => import('./AnimatedSketch').then((m) => ({ default: m.AnimatedSketch })));

/**
 * On the web the animated drawing (and the Reanimated it runs on) loads when
 * one is first shown, not with every page: it draws itself from blank paper
 * anyway, so the paper is what shows while it loads. The static export
 * renders the paper too: a lazy component can't finish on the server.
 */
export function AnimatedSketch(props: AnimatedSketchProps) {
  const hydrated = useIsHydrated();
  if (!hydrated) return <SceneSvg scene={PAPER} />;
  return (
    <Suspense fallback={<SceneSvg scene={PAPER} />}>
      <Lazy {...props} />
    </Suspense>
  );
}
