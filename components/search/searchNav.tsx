import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

/**
 * Keyboard moves through the ⌘K palette's results (nav-search-desk-palette):
 * the highlighted row, ↑↓ to move it, Return to open it. Rows find their
 * place from the page itself (their order on screen), so every row that
 * takes part (DrinkRow, ResultRow) only asks `useSearchNavRow`. Web only;
 * elsewhere it's inert.
 */
const Active = createContext<string | null>(null);

/** What the palette's preview pane shows for a highlighted drink row. */
export interface SearchPreviewItem {
  itemId: string;
  name: string;
  imageUrl: string | null;
  glass: string | null;
  caption?: string;
}

/** The palette's rows by DOM id, with what each previews. Null outside the palette. */
const Previews = createContext<Map<string, SearchPreviewItem> | null>(null);

/** Every row's DOM id starts with this, so the palette can list them in screen order. */
const PREFIX = 'search-row-';

/**
 * A row's part: the id to render (`nativeID`) and whether it's the
 * highlighted one. A drink row passes what the palette's preview shows.
 */
export function useSearchNavRow(preview?: SearchPreviewItem): { nativeID: string | undefined; active: boolean } {
  const id = PREFIX + useId();
  const active = useContext(Active);
  const previews = useContext(Previews);
  const key = preview ? `${preview.itemId}|${preview.name}|${preview.caption ?? ''}|${preview.imageUrl ?? ''}` : '';
  useEffect(() => {
    if (!previews || !preview) return;
    previews.set(id, preview);
    return () => {
      previews.delete(id);
    };
    // The key stands for the preview, which is a new object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews, id, key]);
  return { nativeID: Platform.OS === 'web' ? id : undefined, active: active === id };
}

const rows = (root: HTMLElement | null) => (root ? Array.from(root.querySelectorAll<HTMLElement>(`[id^="${PREFIX}"]`)) : []);

/**
 * The palette's side: the highlighted row (the top one whenever the results
 * change), ↑↓ moving it, `open` pressing it, and Tab switching the scope.
 * `rootId` is the nativeID of the view holding the results.
 */
export function useSearchNav(rootId: string, resultsKey: string, onTab: () => void) {
  const [active, setActive] = useState<string | null>(null);
  const root = () => (typeof document === 'undefined' ? null : document.getElementById(rootId));
  // The top row leads each time the results change, once they've drawn.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const t = setTimeout(() => setActive(rows(root())[0]?.id ?? null), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onTab();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const list = rows(root());
      if (!list.length) return;
      e.preventDefault();
      const at = list.findIndex((r) => r.id === active);
      const next = list[Math.min(list.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))];
      setActive(next.id);
      next.scrollIntoView({ block: 'nearest' });
    };
    // Capture: the field's own handlers stop these keys before they bubble.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  return {
    active,
    /** Return: press the highlighted row, as a click would. False when there's none. */
    open: () => {
      const row = active ? document.getElementById(active) : null;
      row?.click();
      return !!row;
    },
  };
}

/** The palette's side of the previews: the rows register into it, and `preview(active)` reads the highlighted one. */
export function useSearchPreviews() {
  const map = useRef(new Map<string, SearchPreviewItem>()).current;
  return { map, preview: (active: string | null) => (active ? (map.get(active) ?? null) : null) };
}

export function SearchNavProvider({ active, previews, children }: { active: string | null; previews?: Map<string, SearchPreviewItem>; children: ReactNode }) {
  return (
    <Previews.Provider value={previews ?? null}>
      <Active.Provider value={active}>{children}</Active.Provider>
    </Previews.Provider>
  );
}
