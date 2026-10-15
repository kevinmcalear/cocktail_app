import { useEffect, useRef, useState } from 'react';

import type { SortableRecipeItem } from '@/components/recipe/SortableRecipeList';
import type { useCocktailEditor } from '@/hooks/useCocktailEditor';
import { record, redo, startHistory, undo, type History } from '@/lib/editHistory';

type Editor = ReturnType<typeof useCocktailEditor>;

/** What undo puts back: the drink's words, spec and how it's made (not photos or who can see it). */
interface EditSnapshot {
  name: string;
  origin: string;
  description: string;
  notes: string;
  methodIds: string[];
  glasswareId: string | null;
  familyId: string | null;
  iceId: string | null;
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
  familyId: e.familyId,
  iceId: e.iceId,
  recipeItems: e.recipeItems,
});

/**
 * Undo and redo for the drink page's Editing toolbar. It starts once the
 * drink's spec has loaded, so loading it isn't a step; each burst of changes
 * is one step (lib/editHistory.ts).
 */
export function useEditHistory(editor: Editor) {
  const ready = editor.specLoaded;
  const snap = ready ? snapshotOf(editor) : null;
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

  const put = (raw: string) => {
    const s = JSON.parse(raw) as EditSnapshot;
    editor.setName(s.name);
    editor.setOrigin(s.origin);
    editor.setDescription(s.description);
    editor.setNotes(s.notes);
    editor.setMethodIds(s.methodIds);
    editor.setSpecId('glassware', s.glasswareId);
    editor.setSpecId('family', s.familyId);
    editor.setSpecId('ice', s.iceId);
    editor.setRecipeItems(s.recipeItems);
  };
  const move = (step: typeof undo) => {
    if (!history) return;
    const next = step(history);
    if (next === history) return;
    if (burst.current) clearTimeout(burst.current);
    burst.current = null;
    setHistory(next);
    put(next.present);
  };
  return {
    canUndo: !!history?.past.length,
    canRedo: !!history?.future.length,
    undo: () => move(undo),
    redo: () => move(redo),
  };
}
