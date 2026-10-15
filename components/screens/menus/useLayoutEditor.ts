import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ds';
import { itemHref } from '@/lib/itemRoutes';
import { useMenuLibrary, usePickMenuCover, useSaveMenu } from '@/hooks/useMenuMutations';
import { useVenueMenus } from '@/hooks/useMenus';
import { confirmDiscardChanges } from '@/lib/dialogs';
import {
  addDrink,
  addSection,
  layoutChanged,
  layoutFromMenu,
  layoutProblem,
  moveDrink,
  moveSection,
  moveToSection,
  dropDrink,
  removeDrink,
  removeSection,
  setDrinks,
  updateSection,
  type MenuLayout,
  type SectionRule,
} from '@/lib/menuLayout';
import { groupMenus, menuStatus } from '@/lib/menus';
import { applyMenuPaste, type PlacedGroup } from '@/lib/paste';
import { useMenuDrinkHandoff } from '@/store/useMenuDrinkHandoff';
import type { MenuDetail, MenuDrink } from '@/types/menus';

export type EditorSheet = { kind: 'add'; key: string } | { kind: 'section'; key: string } | { kind: 'paste'; key: string | null } | { kind: 'golive' } | { kind: 'share' } | null;

/** How long after the last change the builder saves (b27: no save button). */
const AUTOSAVE_MS = 800;

/**
 * Everything the menu editor does, for its phone and desktop layouts: the
 * layout being edited, saved on its own a moment after each change (a status
 * line says so), and what the sheets need.
 */
export function useLayoutEditor(menu: MenuDetail, { paste = false }: { paste?: boolean } = {}) {
  const router = useRouter();
  const [layout, setLayout] = useState<MenuLayout>(() => layoutFromMenu(menu));
  const [saved, setSaved] = useState<MenuLayout>(layout);
  // New menu's "Paste a list" opens the builder on the paste sheet.
  const [sheet, setSheet] = useState<EditorSheet>(paste ? { kind: 'paste', key: null } : null);
  const [targetKey, setTargetKey] = useState<string | null>(layout.sections[0]?.key ?? null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const save = useSaveMenu(menu.id);
  const cover = usePickMenuCover(menu.id);
  const libraryQuery = useMenuLibrary(menu.barId);
  const library = libraryQuery.data ?? [];
  const refetchLibrary = libraryQuery.refetch;
  const { data: venueMenus = [] } = useVenueMenus(menu.barId);
  const toast = useToast();
  // The handoff below subscribes once; it reads these as they are now.
  const latest = useRef({ toast, router, name: menu.name });
  useEffect(() => {
    latest.current = { toast, router, name: menu.name };
  });
  // Drinks made from this menu while it's open (step 8): their rows say New.
  const [made, setMade] = useState<string[]>([]);

  // A drink made with "Create a new drink" in a section (AddDrinkSheet) goes
  // in that section once it's saved. This screen stays mounted under the wizard.
  useEffect(
    () =>
      useMenuDrinkHandoff.subscribe(async (s) => {
        if (!s.pending) return;
        const handoff = useMenuDrinkHandoff.getState().consume();
        if (!handoff) return;
        const { data } = await refetchLibrary();
        const drink = data?.find((d) => d.id === handoff.drinkId);
        if (!drink) return;
        setLayout((l) => addDrink(l, handoff.sectionId, drink));
        setMade((ids) => [...ids, drink.id]);
        const now = latest.current;
        now.toast.show({ title: `${drink.name} is made and on ${now.name}`, action: { label: 'Open it', onPress: () => now.router.push(itemHref(drink.kind === 'beer' ? 'Beer' : drink.kind === 'wine' ? 'Wine' : 'Cocktail', drink.id) as never) } });
      }),
    [refetchLibrary]
  );

  const status = menuStatus(menu, now);
  const changed = layoutChanged(layout, saved);
  const groups = groupMenus(venueMenus.filter((m) => m.barId === menu.barId && m.id !== menu.id), now);
  // A venue's drinks already on (or going on) another of its menus. Home nights don't share drinks out like that.
  const others = menu.barId ? [...groups.on, ...groups.upcoming] : [];
  const elsewhere: Record<string, string> = {};
  for (const m of others) for (const id of m.itemIds) elsewhere[id] ??= m.name;
  const section = (key: string | null) => layout.sections.find((s) => s.key === key) ?? null;

  const edit = (next: MenuLayout) => {
    setError(null);
    setLayout(next);
  };

  /** Saves if anything changed. Resolves false (with the error shown) when it couldn't. */
  const saveLayout = save.mutateAsync;
  const persist = useCallback(async (): Promise<boolean> => {
    const problem = layoutProblem(layout);
    if (problem) {
      setError(problem);
      return false;
    }
    if (!changed) return true;
    // What this save writes: edits made while it's on the way save after it.
    const snapshot = layout;
    try {
      await saveLayout(snapshot);
      setSaved(snapshot);
      setSavedAt(Date.now());
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save. Your changes are still here; try again.');
      return false;
    }
  }, [layout, changed, saveLayout]);

  // Autosave: a moment after the last change, one save at a time. A layout that
  // can't be saved (a section with no name) waits, with the problem shown.
  const saving = save.isPending;
  useEffect(() => {
    if (!changed || saving || layoutProblem(layout)) return;
    const timer = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [layout, changed, saving, persist]);

  return {
    menu,
    layout,
    status,
    changed,
    saving: save.isPending,
    savedAt,
    error,
    library,
    elsewhere,
    others,
    sheet,
    setSheet,
    targetKey,
    setTargetKey,
    section,
    coverBusy: cover.isPending,
    rename: (name: string) => edit({ ...layout, name }),
    add: (key: string, drink: MenuDrink) => edit(addDrink(layout, key, drink)),
    /** Added from the library: says so, with Undo (which takes back only that drink). */
    addWithUndo: (key: string, drink: MenuDrink) => {
      edit(addDrink(layout, key, drink));
      const into = section(key)?.name ?? 'the menu';
      toast.show({ title: `${drink.name} added to ${into}`, action: { label: 'Undo', onPress: () => setLayout((l) => removeDrink(l, key, drink.id)) } });
    },
    made,
    remove: (key: string, drinkId: string) => edit(removeDrink(layout, key, drinkId)),
    reorder: (key: string, drinks: MenuDrink[]) => edit(setDrinks(layout, key, drinks)),
    move: (key: string, from: number, to: number) => edit(moveDrink(layout, key, from, to)),
    moveTo: (fromKey: string, drinkId: string, toKey: string) => edit(moveToSection(layout, fromKey, drinkId, toKey)),
    drop: (drink: MenuDrink, fromKey: string | null, toKey: string, index: number) => edit(dropDrink(layout, drink, fromKey, toKey, index)),
    addSection: () => {
      const next = addSection(layout);
      edit(next);
      setSheet({ kind: 'section', key: next.sections[next.sections.length - 1].key });
    },
    applyPaste: (intoKey: string | null, groups: PlacedGroup[]) => edit(applyMenuPaste(layout, intoKey, groups)),
    updateSection: (key: string, rule: SectionRule) => edit(updateSection(layout, key, rule)),
    moveSection: (key: string, by: -1 | 1) => edit(moveSection(layout, key, by)),
    removeSection: (key: string) => edit(removeSection(layout, key)),
    pickCover: async () => {
      try {
        const url = await cover.mutateAsync();
        if (url) edit({ ...layout, coverUrl: url, coverPosition: 50 });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Couldn’t upload the cover.');
      }
    },
    removeCover: () => edit({ ...layout, coverUrl: null }),
    persist,
    goLive: async () => {
      if (await persist()) setSheet({ kind: 'golive' });
    },
    /** A home menu: save what's changed, then the share step (it shares the saved menu). */
    share: async () => {
      if (await persist()) setSheet({ kind: 'share' });
    },
    // Saves what's left first; only asks when that can't be saved.
    leave: async () => {
      if (changed && !(await persist()) && !(await confirmDiscardChanges(true))) return;
      if (router.canGoBack()) router.back();
      else router.replace(`/menus/${menu.id}`);
    },
    done: () => {
      setSheet(null);
      router.replace(`/menus/${menu.id}`);
    },
  };
}

export type LayoutEditor = ReturnType<typeof useLayoutEditor>;
