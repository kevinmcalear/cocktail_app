import { useEffect, useRef, useState } from 'react';

import { useDebounced } from '@/hooks/useDiscover';
import { aimAfter, movedFrom, type Camera, type MapAim, type Viewport } from '@/lib/discoverMap';

/** How long the map sits still before a move counts. */
const SETTLE_MS = 350;

/**
 * Discover's map moves (the maps report only the person's own). `settled`:
 * the view once it sits still. A move that settles far enough from what the
 * results are for (the view last searched, else `fit`, the camera that fit
 * them) searches it at once while `follow` (browsing), and is `offer`ed for
 * "Search this area" otherwise. `reset` when the camera refits. `focus`: the
 * bar a list row is resting on; `camera` is the last of it and `fit`
 * (aimAfter), and a fly to it is where moves count from, not a move.
 */
export function useMapMoves(fit: Camera | null, follow: boolean, onSearch: (v: Viewport) => void, focus: Camera | null = null) {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const settled = useDebounced(viewport, SETTLE_MS);
  const [searched, setSearched] = useState<Viewport | null>(null);
  const [aim, setAim] = useState<MapAim>({ fit, focus, at: focus ?? fit });
  if (aim.fit !== fit || aim.focus !== focus) {
    const next = aimAfter(aim, fit, focus);
    setAim(next);
    if (next.fresh) {
      setViewport(null);
      setSearched(null);
    }
  }
  const from = searched ?? aim.at;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Gone (back to the list), a move still waiting doesn't search.
  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (v: Viewport) => {
    setSearched(v);
    onSearch(v);
  };
  const onMove = (v: Viewport | null) => {
    setViewport(v);
    clearTimeout(timer.current);
    if (v && follow && movedFrom(from, v)) timer.current = setTimeout(() => search(v), SETTLE_MS);
  };
  const reset = () => {
    setViewport(null);
    setSearched(null);
  };
  const offer = !follow && viewport && settled === viewport && movedFrom(from, viewport) ? viewport : null;
  return { settled, offer, onMove, search, reset, camera: aim.at };
}
