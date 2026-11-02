import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

/**
 * Keyboard moves through the ⌘K palette's results (Prod-desk-cmdk): the
 * highlighted row, ↑↓ to move it, Return to open it. Rows find their place
 * from the page itself (their order on screen), so every row that takes part
 * (DrinkRow, ResultRow, PaletteRow) only asks `useSearchNavRow`. Web only;
 * elsewhere it's inert.
 */
const Active = createContext<string | null>(null);

/** Every row's DOM id starts with this, so the palette can list them in screen order. */
const PREFIX = 'search-row-';

/** A row's part: the id to render (`nativeID`) and whether it's the highlighted one. */
export function useSearchNavRow(): { nativeID: string | undefined; active: boolean } {
  const id = PREFIX + useId();
  const active = useContext(Active);
  return { nativeID: Platform.OS === 'web' ? id : undefined, active: active === id };
}

const rows = (root: HTMLElement | null) => (root ? Array.from(root.querySelectorAll<HTMLElement>(`[id^="${PREFIX}"]`)) : []);
const byId = (id: string) => (typeof document === 'undefined' ? null : document.getElementById(id));

/**
 * The palette's side: the highlighted row, ↑↓ moving it, and `open` pressing
 * it. `rootId` is the nativeID of the view holding the results. Each time the
 * results change the first row of `leadId` leads (Log a batch or Go to, so
 * Return opens what was found rather than adding it again), else the first
 * row of all. Rows that draw late (the library still loading) take the lead
 * until ↑ or ↓ moves it.
 */
export function useSearchNav(rootId: string, resultsKey: string, leadId?: string) {
  const [active, setActive] = useState<string | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    const root = byId(rootId);
    if (Platform.OS !== 'web' || !root) return;
    moved.current = false;
    const lead = () => {
      if (!moved.current) setActive((leadId ? rows(byId(leadId))[0] : undefined)?.id ?? rows(root)[0]?.id ?? null);
    };
    const t = setTimeout(lead, 120);
    const watch = new MutationObserver(lead);
    watch.observe(root, { childList: true, subtree: true });
    return () => {
      clearTimeout(t);
      watch.disconnect();
    };
  }, [resultsKey, rootId, leadId]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const list = rows(byId(rootId));
      if (!list.length) return;
      e.preventDefault();
      moved.current = true;
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
      const row = active ? byId(active) : null;
      row?.click();
      return !!row;
    },
  };
}

export function SearchNavProvider({ active, children }: { active: string | null; children: ReactNode }) {
  return <Active.Provider value={active}>{children}</Active.Provider>;
}
