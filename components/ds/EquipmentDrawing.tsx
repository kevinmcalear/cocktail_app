import { memo } from 'react';

import { kitArt, paintKit } from '@/lib/sketch/kit';
import type { Scene } from '@/lib/sketch/scene';

import { SceneSvg, type SketchDetail } from './SketchDrawing';
import { useScene } from './useScene';

// Painted once per piece of kit and detail, then reused by every tile. There
// are about forty ids, so the cache stays small.
const scenes = new Map<string, Scene>();

/**
 * A piece of bar kit (lib/techniques/equipment.ts id) drawn in the house hand,
 * filling its frame on the paper colour. Kit we don't know is drawn as an
 * appliance box. Decorative. `lazy` (thumbs, and tiles in a grid) paints when
 * the app is idle, on blank paper till then.
 */
export const EquipmentDrawing = memo(function EquipmentDrawing({ id, detail = 'full', lazy = detail === 'thumb' }: { id: string; detail?: SketchDetail; lazy?: boolean }) {
  return <SceneSvg scene={useScene(scenes, `${id}|${detail}`, lazy, () => paintKit(kitArt(id), { seed: id, detail }))} />;
});
