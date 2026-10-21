import { useEffect, useRef, useState } from 'react';

import type { SortableRecipeItem } from '@/lib/recipeItem';
import { record, redo, startHistory, undo, type History } from '@/lib/editHistory';

import type { DrinkEditor as Editor } from './EditParts';

/** What undo puts back: the drink's words, spec and how it's made (not photos or who can see it). */
interface EditSnapshot {
  name: string;
  origin: string;
  description: string;
  notes: string;
  methodIds: string[];
  glasswareId: string | null;
  /** The drink's real glass, where the editor has one (a draft doesn't). */
  glassModel: unknown;
  familyId: string | null;
  iceId: string | null;
  /** How the ice sits and the ice it's made with, where the editor has them (a draft doesn't). */
  iceBuild: unknown;
  methodIceId: string | null;
  recipeItems: SortableRecipeItem[];
}

/** A pause this long ends a burst of typing, so the next change is a new step. */
const BURST_MS = 700;

const snapshotOf = (e: Editor): EditSnapshot => ({
  name: e.name,
  origin: e.origin,
  description: e.description,
  notes: e.notes,
  methodIds: e.methodIds,
  glasswareId: e.glasswareId,
  glassModel: 'glassModel' in e ? e.glassModel : null,
  familyId: e.familyId,
  iceId: e.iceId,
  iceBuild: 'iceBuild' in e ? e.iceBuild : null,
  methodIceId: 'methodIceId' in e ? e.methodIceId : null,
  recipeItems: e.recipeItems,
});

/**
 * Undo and redo for the drink page's Editing toolbar. It starts once the
 * drink's spec has loaded, so loading it isn't a step; each burst of changes
 * is one step (lib/editHistory.ts).
 */
export function useEditHistory(editor: Editor) {
  return useSnapshotHistory(editor.specLoaded ? snapshotOf(editor) : null, (s: EditSnapshot) => {
    editor.setName(s.name);
    editor.setOrigin(s.origin);
    editor.setDescription(s.description);
    editor.setNotes(s.notes);
    editor.setMethodIds(s.methodIds);
    editor.setSpecId('glassware', s.glasswareId);
    if ('setGlassModel' in editor) editor.setGlassModel(s.glassModel as typeof editor.glassModel);
    editor.setSpecId('family', s.familyId);
    editor.setSpecId('ice', s.iceId);
    // The build after the ice: its top layer is the ice, so it wins when there is one.
    if ('setIceBuild' in editor) {
      editor.setIceBuild((s.iceBuild as typeof editor.iceBuild) ?? (s.iceId ? [{ ice: s.iceId }] : []));
      if (s.methodIceId !== editor.methodIceId) editor.setMethodIceId(s.methodIceId);
    }
    editor.setRecipeItems(s.recipeItems);
  });
}

/**
 * Undo and redo over any editor's words: `snap` is what undo puts back (null
 * until it has loaded), `put` puts one back into the editor. The beer and
 * wine editor uses it too.
 */
export function useSnapshotHistory<S>(snap: S | null, put: (s: S) => void) {
  const key = snap ? JSON.stringify(snap) : null;
  const [history, setHistory] = useState<History<string> | null>(null);
  const burst = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!key) return;
    // Read before the update: React runs the updater later, after the timer below is reset.
    const step = !burst.current;
    setHistory((h) => {
      if (!h) return startHistory(key);
      if (h.present === key) return h;
      return record(h, key, step);
    });
    if (burst.current) clearTimeout(burst.current);
    burst.current = setTimeout(() => {
      burst.current = null;
    }, BURST_MS);
  }, [key]);

  const move = (step: typeof undo) => {
    if (!history) return;
    const next = step(history);
    if (next === history) return;
    if (burst.current) clearTimeout(burst.current);
    burst.current = null;
    setHistory(next);
    put(JSON.parse(next.present) as S);
  };
  return {
    canUndo: !!history?.past.length,
    canRedo: !!history?.future.length,
    undo: () => move(undo),
    redo: () => move(redo),
  };
}
