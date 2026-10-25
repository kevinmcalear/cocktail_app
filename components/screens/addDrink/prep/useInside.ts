import { useState } from 'react';

import { prepAmounts, type PrepDraft, type PrepDraftLine } from '@/lib/prepKinds';

import type { TrailItem } from '../Trail';
import type { InDrinkPour } from './InDrink';

/**
 * A line of a recipe being made in-house too, one level down
 * (make-anything-steps-2, step 8), for the phone's builder and the desktop
 * card alike: which line, what the level below needs, and putting the
 * recipe on the line when it's done. Leaving a level that was just started
 * (a new line, or a line renamed from the search) puts the lines back as
 * they were.
 */
export function useInside(draft: PrepDraft, setDraft: (d: PrepDraft) => void, here: string) {
  const [inside, setInside] = useState<{ key: string; before?: PrepDraftLine[] } | null>(null);
  const line = inside ? (draft.lines.find((l) => l.key === inside.key) ?? null) : null;
  const amount = line ? (prepAmounts(draft).find((a) => a.line.key === line.key)?.amount ?? null) : null;
  return {
    /** The line being made one level down, if any. */
    line,
    /** Open a line's recipe; `before` is the lines as they were when it was just added or renamed. */
    open: (key: string, before?: PrepDraftLine[]) => setInside({ key, before }),
    /** What the level below gets: its name, recipe so far, and what this recipe takes of it. */
    props: line
      ? {
          name: line.name || 'New recipe',
          drinkName: here,
          initial: line.prep ?? null,
          inDrink: { name: here, amount: amount === null ? '' : String(amount), unit: line.unit } satisfies InDrinkPour,
          onDone: (prep: PrepDraft, name: string) => {
            setDraft({ ...draft, lines: draft.lines.map((l) => (l.key === line.key ? { ...l, id: null, name, prep, slot: undefined } : l)) });
            setInside(null);
          },
          onClose: () => {
            if (inside?.before) setDraft({ ...draft, lines: inside.before });
            setInside(null);
          },
        }
      : null,
  };
}

/** Inside a recipe, only the level just above is a way back: further up would leave the recipes below it unsaved. */
export function aboveRecipe(items: readonly TrailItem[]): TrailItem[] {
  return items.map(({ label }) => ({ label }));
}
