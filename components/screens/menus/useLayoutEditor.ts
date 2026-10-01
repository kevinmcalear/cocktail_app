import { useRouter } from 'expo-router';
import { useState } from 'react';

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
  removeDrink,
  removeSection,
  setDrinks,
  updateSection,
  type MenuLayout,
  type SectionRule,
} from '@/lib/menuLayout';
import { groupMenus, menuStatus } from '@/lib/menus';
import { applyMenuPaste, type PlacedGroup } from '@/lib/paste';
import type { MenuDetail, MenuDrink } from '@/types/menus';

export type EditorSheet = { kind: 'add'; key: string } | { kind: 'section'; key: string } | { kind: 'paste'; key: string | null } | { kind: 'golive' } | null;

/**
 * Everything the menu editor does, for its phone and desktop layouts: the
 * layout being edited, saving it in one go, and what the sheets need.
 */
export function useLayoutEditor(menu: MenuDetail) {
  const router = useRouter();
  const [layout, setLayout] = useState<MenuLayout>(() => layoutFromMenu(menu));
  const [saved, setSaved] = useState<MenuLayout>(layout);
  const [sheet, setSheet] = useState<EditorSheet>(null);
  const [targetKey, setTargetKey] = useState<string | null>(layout.sections[0]?.key ?? null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const save = useSaveMenu(menu.id);
  const cover = usePickMenuCover(menu.id);
  const { data: library = [] } = useMenuLibrary(menu.barId);
  const { data: venueMenus = [] } = useVenueMenus(menu.barId);

  const status = menuStatus(menu, now);
  const changed = layoutChanged(layout, saved);
  const groups = groupMenus(venueMenus.filter((m) => m.barId === menu.barId && m.id !== menu.id), now);
  const others = [...groups.on, ...groups.upcoming];
  const elsewhere: Record<string, string> = {};
  for (const m of others) for (const id of m.itemIds) elsewhere[id] ??= m.name;
  const section = (key: string | null) => layout.sections.find((s) => s.key === key) ?? null;

  const edit = (next: MenuLayout) => {
    setError(null);
    setLayout(next);
  };

  /** Saves if anything changed. Resolves false (with the error shown) when it couldn't. */
  const persist = async (): Promise<boolean> => {
    const problem = layoutProblem(layout);
    if (problem) {
      setError(problem);
      return false;
    }
    if (!changed) return true;
    try {
      await save.mutateAsync(layout);
      setSaved(layout);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save. Your changes are still here; try again.');
      return false;
    }
  };

  return {
    menu,
    layout,
    status,
    changed,
    saving: save.isPending,
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
    remove: (key: string, drinkId: string) => edit(removeDrink(layout, key, drinkId)),
    reorder: (key: string, drinks: MenuDrink[]) => edit(setDrinks(layout, key, drinks)),
    move: (key: string, from: number, to: number) => edit(moveDrink(layout, key, from, to)),
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
    leave: async () => {
      if (!(await confirmDiscardChanges(changed))) return;
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
