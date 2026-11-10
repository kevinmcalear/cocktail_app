import { useState } from 'react';

import type { PrepDraft, PrepDraftLine } from '@/lib/prepKinds';

/**
 * A line of a recipe made in-house too, one level down (board Add-parts):
 * which line, what the part's page needs, and putting the recipe on the
 * line as it's written and when it's done. Backing out of a level just
 * started (a new line, or a line renamed from the search), with nothing
 * kept, puts the lines back as they were.
 */
export function useInside(draft: PrepDraft, setDraft: (d: PrepDraft) => void) {
  const [inside, setInside] = useState<{ key: string; before?: PrepDraftLine[]; kept?: boolean } | null>(null);
  const line = inside ? (draft.lines.find((l) => l.key === inside.key) ?? null) : null;
  const put = (prep: PrepDraft, name: string) => {
    if (!line) return;
    setDraft({ ...draft, lines: draft.lines.map((l) => (l.key === line.key ? { ...l, id: null, name, prep, slot: undefined } : l)) });
    setInside(null);
  };
  return {
    /** The line being made one level down, if any. */
    line,
    /** Open a line's recipe; `before` is the lines as they were when it was just added or renamed. */
    open: (key: string, before?: PrepDraftLine[]) => setInside({ key, before }),
    /** A part's flat page (Add-parts, 2): each change goes on the line as it's made, so the draft keeps it; the level stays open. */
    keep: (prep: PrepDraft, name: string) => {
      if (!line) return;
      setDraft({ ...draft, lines: draft.lines.map((l) => (l.key === line.key ? { ...l, id: null, name, prep, slot: undefined, bottle: undefined } : l)) });
      if (!inside?.kept) setInside({ ...inside!, kept: true });
    },
    /** A part's name taken (Add-parts, 6), Use yours: the line uses the one already here, and the level closes. */
    use: (id: string, name: string) => {
      if (!line) return;
      setDraft({ ...draft, lines: draft.lines.map((l) => (l.key === line.key ? { ...l, id, name, prep: undefined, slot: undefined } : l)) });
      setInside(null);
    },
    /** What the level below gets: its name and recipe so far. */
    props: line
      ? {
          name: line.name || 'New recipe',
          initial: line.prep ?? null,
          onDone: (prep: PrepDraft, name: string) => put({ ...prep, at: undefined }, name),
          onClose: () => {
            if (inside?.before && !inside.kept) setDraft({ ...draft, lines: inside.before });
            setInside(null);
          },
        }
      : null,
  };
}
