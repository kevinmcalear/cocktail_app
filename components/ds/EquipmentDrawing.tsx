import { memo } from 'react';

import { kitArt, paintKit } from '@/lib/sketch/kit';
import type { Scene } from '@/lib/sketch/scene';

import { SceneSvg, type SketchDetail } from './SketchDrawing';

// Painted once per piece of kit and detail, then reused by every tile. There
// are about forty ids, so the cache stays small.
const scenes = new Map<string, Scene>();
function sceneFor(id: string, detail: SketchDetail): Scene {
  const key = `${id}|${detail}`;
  let scene = scenes.get(key);
  if (!scene) scenes.set(key, (scene = paintKit(kitArt(id), { seed: id, detail })));
  return scene;
}

/**
 * A piece of bar kit (lib/techniques/equipment.ts id) drawn in the house hand,
 * filling its frame on the paper colour. Kit we don't know is drawn as an
 * appliance box. Decorative.
 */
export const EquipmentDrawing = memo(function EquipmentDrawing({ id, detail = 'full' }: { id: string; detail?: SketchDetail }) {
  return <SceneSvg scene={sceneFor(id, detail)} />;
});
