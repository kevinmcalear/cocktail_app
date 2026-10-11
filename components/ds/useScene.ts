import { useEffect, useState } from 'react';

import { whenIdle } from '@/lib/idleQueue';
import type { Scene } from '@/lib/sketch/scene';

/** Blank house paper: a thumb before its painting is ready. */
export const PAPER: Scene = { size: 512, els: [] };

/**
 * The painted scene for `key` from `cache`. A hero paints now; a `lazy` one
 * (thumbs and tiles: a screen of dozens) paints in a coming idle slice and
 * shows blank paper until then, so a long list never blocks a tap or a
 * frame. A null key (not ready to draw yet) is blank paper.
 */
export function useScene(cache: Map<string, Scene>, key: string | null, lazy: boolean, paint: () => Scene): Scene {
  // The idle painting lands in state, not just the cache: the React Compiler
  // memoizes `cache.get(key)`, so a re-render alone would read the old miss.
  const [painted, setPainted] = useState<{ key: string; scene: Scene } | null>(null);
  const cached = key === null ? PAPER : (cache.get(key) ?? (painted?.key === key ? painted.scene : undefined));
  const wait = !cached && lazy;
  useEffect(() => {
    if (!wait || key === null) return;
    let live = true;
    whenIdle(() => {
      if (!live) return;
      let scene = cache.get(key);
      if (!scene) cache.set(key, (scene = paint()));
      setPainted({ key, scene });
    });
    return () => {
      live = false;
    };
  }, [wait, cache, key, paint]);
  if (cached) return cached;
  if (wait) return PAPER;
  const scene = paint();
  cache.set(key!, scene);
  return scene;
}
