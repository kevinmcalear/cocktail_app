import { onlineManager } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ds';
import { itemHref } from '@/lib/itemRoutes';
import { useBarDrinks } from '@/hooks/useHomeBar';
import type { MenuLayoutWrite } from '@/hooks/barWrites';
import { menuLayoutWrite, useMenuLibrary, usePickMenuCover, useSaveMenuLayout } from '@/hooks/useMenuMutations';
import { useUnsentWrites } from '@/hooks/useUnsentWrites';
import { useVenueMenus } from '@/hooks/useMenus';
import { confirmDiscardChanges } from '@/lib/dialogs';
import { isNetworkError, MENU_LAYOUT } from '@/lib/offlineWrites';
import { saveErrorWords } from '@/lib/saveErrorWords';
import { useDeleteDrink } from '@/components/screens/drink/useDeleteDrink';
import {
  addDrink,
  addSection,
  layoutChanged,
  creditOf,
  layoutFromMenu,
  layoutProblem,
  moveDrink,
  moveSection,
  moveToSection,
  dropDrink,
  removeDrink,
  setDrinkPrice,
  setMenuPrice,
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

export type EditorSheet = { kind: 'add'; key: string } | { kind: 'section'; key: string } | { kind: 'paste'; key: string | null } | { kind: 'golive' } | { kind: 'share' } | { kind: 'night' } | { kind: 'ends' } | { kind: 'row'; key: string; drinkId: string } | null;

/**
 * A layout's save to wait for, or with no signal one kept on the phone to go
 * on from: a refusal after waiting is kept and shown on Tonight
 * (components/UnsentWrites.tsx), not in the editor.
 */
function sentOrKept(sent: Promise<void>, offline: boolean): Promise<void> {
  // Out of tries on a dropped connection (bar wifi with no internet): kept on the phone as well (lib/react-query.ts), listed to send again.
  const done = sent.catch((e: unknown) => {
    if (!isNetworkError(e)) throw e;
  });
  if (!offline) return done;
  void done.catch(() => undefined);
  return Promise.resolve();
}

/** How long after the last change the builder saves (b27: no save button). */
const AUTOSAVE_MS = 800;

/**
 * Everything the menu editor does, for its phone and desktop layouts: the
 * layout being edited, saved on its own a moment after each change (a status
 * line says so), and what the sheets need.
 */
export function useLayoutEditor(menu: MenuDetail, { paste = false }: { paste?: boolean } = {}) {
  const router = useRouter();
  // This menu's saves still on the phone (no signal, or refused): the newest is where the editor starts, not the older menu.
  const unsent = useUnsentWrites<MenuLayoutWrite>(MENU_LAYOUT).filter((w) => w.variables.menuId === menu.id);
  // The newest one still to go (one the database refused isn't a start: the menu as it is now is).
  const kept = unsent.filter((w) => !w.failed).at(-1)?.variables.layout;
  const [layout, setLayout] = useState<MenuLayout>(() => (kept ? { ...kept, prices: {} } : layoutFromMenu(menu)));
  const [saved, setSaved] = useState<MenuLayout>(layout);
  // New menu's "Paste a list" opens the builder on the paste sheet.
  const [sheet, setSheet] = useState<EditorSheet>(paste ? { kind: 'paste', key: null } : null);
  const [targetKey, setTargetKey] = useState<string | null>(layout.sections[0]?.key ?? null);
  const [error, setError] = useState<string | null>(null);
  // The cover's own problem, shown on the cover: it never holds up saving the rest.
  const [coverError, setCoverError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const save = useSaveMenuLayout();
  const cover = usePickMenuCover(menu.id);
  const libraryQuery = useMenuLibrary(menu.barId);
  const library = libraryQuery.data ?? [];
  // A home menu's "You can make these" (Q12): what the shelf makes. A venue skips it for now.
  const shelf = useBarDrinks(!menu.barId);
  const canMake = menu.barId ? [] : shelf.canMake.map((d) => d.id);
  const refetchLibrary = libraryQuery.refetch;
  const { data: venueMenus = [] } = useVenueMenus(menu.barId);
  const toast = useToast();
  const deleteForGood = useDeleteDrink();
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
  // Drinks deleted from a row while their toast is up: off the rows, but saved where they were
  // until the delete goes, so closing the app or leaving first loses no menu place (useDeleteDrink).
  const [pending, setPending] = useState<{ key: string; at: number; drink: MenuDrink }[]>([]);
  const outgoing = pending.reduceRight((l, p) => addDrink(l, p.key, p.drink, p.at), layout);
  const changed = layoutChanged(outgoing, saved);
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
  const update = (fn: (l: MenuLayout) => MenuLayout) => {
    setError(null);
    setLayout(fn);
  };

  /** Saves if anything changed. Resolves false (with the error shown) when it couldn't. */
  const send = save.mutateAsync;
  const persist = async (): Promise<boolean> => {
    const problem = layoutProblem(layout);
    if (problem) {
      setError(problem);
      return false;
    }
    if (!changed) return true;
    // What this save writes: edits made while it's on the way save after it.
    const snapshot = outgoing;
    // The credit only when it changed, so an editor opened from older data can't clear someone's credit.
    // Prices are the drinks' own: written once the menu holds them.
    const offline = !onlineManager.isOnline();
    const write = menuLayoutWrite(menu.id, snapshot, creditOf(snapshot) !== creditOf(saved), offline);
    try {
      // No signal: kept on the phone and sent when there is (Sta-menu: "Edits wait on this phone and go up when you're back").
      await sentOrKept(send(write), offline);
      setSaved({ ...snapshot, prices: {} });
      setLayout((l) => (l.prices === snapshot.prices ? { ...l, prices: {} } : l));
      setSavedAt(Date.now());
      return true;
    } catch (e) {
      setError(`${saveErrorWords(e)} Your changes are still here; try again.`);
      return false;
    }
  };

  // Autosave: a moment after the last change, one save at a time. A layout that
  // can't be saved (a section with no name), or a save that failed (a price
  // the caller can't change), waits with the problem shown until the next edit.
  // One waiting for signal isn't saving: the next change queues after it.
  const saving = save.isPending && !save.isPaused;
  useEffect(() => {
    if (!changed || saving || error || layoutProblem(layout)) return;
    const timer = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [layout, changed, saving, error, persist]);

  return {
    menu,
    layout,
    status,
    changed,
    saving,
    savedAt,
    /** Saves of this menu kept on the phone: waiting for signal, or refused (then listed on Tonight to send again). */
    waiting: unsent.some((w) => !w.failed),
    /** A save of this menu the database refused after it waited: kept, and sent again from Tonight. */
    unsentFailed: unsent.some((w) => !!w.failed),
    error,
    library,
    canMake,
    elsewhere,
    others,
    sheet,
    setSheet,
    targetKey,
    setTargetKey,
    section,
    coverBusy: cover.isPending,
    coverError,
    rename: (name: string) => edit({ ...layout, name }),
    /** "Photo by": who took the cover photo. */
    setCoverCredit: (credit: string) => edit({ ...layout, coverCredit: credit }),
    add: (key: string, drink: MenuDrink) => edit(addDrink(layout, key, drink)),
    /** Added from the library: says so, with Undo (which takes back only that drink). */
    addWithUndo: (key: string, drink: MenuDrink) => {
      edit(addDrink(layout, key, drink));
      const into = section(key)?.name ?? 'the menu';
      toast.show({ title: `${drink.name} added to ${into}`, action: { label: 'Undo', onPress: () => setLayout((l) => removeDrink(l, key, drink.id)) } });
    },
    made,
    remove: (key: string, drinkId: string) => edit(removeDrink(layout, key, drinkId)),
    /** Delete drink from a row's ...: off the rows now, deleted (with its menu places) once its toast goes; Undo puts it back where it was. */
    deleteDrink: (drink: MenuDrink) => {
      const places = layout.sections.flatMap((s) => {
        const at = s.drinks.findIndex((d) => d.id === drink.id);
        return at < 0 ? [] : [{ key: s.key, at, drink: s.drinks[at] }];
      });
      edit(places.reduce((l, p) => removeDrink(l, p.key, drink.id), layout));
      setPending((p) => [...p, ...places]);
      deleteForGood({
        id: drink.id,
        name: drink.name,
        onUndo: () => setLayout((l) => places.reduce((m, p) => addDrink(m, p.key, p.drink, p.at), l)),
        onGone: () => setPending((p) => p.filter((x) => !places.includes(x))),
      });
    },
    // From the layout as it is when React applies them, so the phone's Done can set both prices at once.
    setPrice: (drinkId: string, price: string | null) => update((l) => setDrinkPrice(l, drinkId, price)),
    /** This menu's own price for the drink; null goes back to the drink's. */
    setMenuPrice: (drinkId: string, price: string | null) => update((l) => setMenuPrice(l, drinkId, price)),
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
      setCoverError(null);
      try {
        const url = await cover.mutateAsync();
        // A new photo is someone else's until said otherwise.
        if (url) update((l) => ({ ...l, coverUrl: url, coverPosition: 50, coverCredit: null }));
      } catch {
        setCoverError('Didn’t upload. Try again.');
      }
    },
    removeCover: () => {
      setCoverError(null);
      edit({ ...layout, coverUrl: null, coverCredit: null });
    },
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
