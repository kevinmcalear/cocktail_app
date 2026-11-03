import { useMemo, useState } from 'react';

import { useTileLines } from '@/components/screens/library/useTileLines';
import { useLibraryView } from '@/components/screens/library/useLibraryView';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useGuestDrinkAllergens } from '@/hooks/useGuestAllergies';
import { useKitShelves } from '@/hooks/useKitCheck';
import { useVenueMenus } from '@/hooks/useMenus';
import { usePricedItemIds } from '@/hooks/usePricing';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { useBarRiffs, useStaffList } from '@/hooks/useStaffList';
import { useTonight } from '@/hooks/useTonight';
import { usePrepFacts, useVenueShelves } from '@/hooks/useVenueShelves';
import { venueContextIds } from '@/lib/barContextFilter';
import { CAPSULE_SHOW, capsuleChips, capsuleOf, onNowSub, serviceTag, type StaffCapsule } from '@/lib/drinksTab';
import type { ItemCategory } from '@/lib/itemRoutes';
import { BATCHED_STYLES, DRINK_CATEGORIES, filterGroups, itemIdOf, menuDrinks, parseShow, PREP_GROUPS, TYPE_FILTERS, type Show } from '@/lib/libraryFilters';
import { groupMenus, menuDateLine } from '@/lib/menus';
import { classicRows } from '@/lib/staffList';
import { offTonight } from '@/lib/tonight';
import type { SearchItem } from '@/types/search';

/**
 * The Drinks tab's data at a bar (Prod-phone drinks, staff): the bar's spec
 * book in every view (?show=, lib/libraryFilters.ts) under its capsule, the
 * menu on now for the On now card, each row's line and tag (Off tonight, an
 * allergen that changes the serve), and the counts for the chips. `beside`:
 * the list beside a drink on a desktop holds its own view (useLibraryView).
 */
export function useStaffDrinks(beside: boolean) {
  const { active, isLoading: venuesLoading } = useActiveVenue();
  const activeId = active?.id ?? null;
  const { view: params, setView } = useLibraryView(beside);
  const show = parseShow(params.show, !!activeId || venuesLoading);
  const capsule = capsuleOf(show);
  const contextIds = useMemo(() => venueContextIds(activeId, venuesLoading), [activeId, venuesLoading]);
  const { items, isLoading, error } = useSearchCatalog(contextIds);
  const { data: capabilities, isLoading: capsLoading } = useCapabilities(activeId);
  const canCost = !!capabilities?.includes('costs');
  const { data: pricedIds } = usePricedItemIds(activeId, canCost);
  const { data: menus } = useVenueMenus(activeId);
  const staff = useStaffList(activeId);
  const linked = useBarRiffs(activeId);
  const [now] = useState(() => Date.now());

  const published = useMemo(() => items.filter((i) => !i.isDraft), [items]);
  const shelves = useVenueShelves(activeId, published);
  const prepFacts = usePrepFacts(shelves.preps);
  const kit = useKitShelves(activeId, published);
  const byMenu = useMemo(
    () =>
      menuDrinks(
        (menus ?? []).filter((m) => m.barId === activeId),
        now,
        params.menu ?? null
      ),
    [menus, activeId, now, params.menu]
  );
  const lists = useMemo(() => {
    const priced = new Set(pricedIds ?? []);
    const inSet = (ids: string[]) => {
      const set = new Set(ids);
      return published.filter((i) => set.has(itemIdOf(i.id)));
    };
    const rnd = new Set(byMenu.rnd);
    const out: Record<Show, SearchItem[]> = {
      // R&D (trials, a flight's control) has its own filter, out of All.
      all: published.filter((i) => i.category && DRINK_CATEGORIES.includes(i.category as ItemCategory) && !rnd.has(itemIdOf(i.id))),
      rnd: inSet(byMenu.rnd),
      'on-menu': inSet(byMenu.on),
      staff: [],
      past: inSet(byMenu.past),
      cocktails: [],
      ingredients: [],
      beer: [],
      wine: [],
      'needs-price': canCost ? published.filter((i) => i.category === 'Ingredient' && !priced.has(i.id)) : [],
      batched: published.filter((i) => i.category === 'Cocktail' && BATCHED_STYLES.includes(i.serviceStyle ?? '')),
      ...shelves,
      ready: kit.ready.filter((i) => !rnd.has(itemIdOf(i.id))),
      needs: kit.needs.filter((i) => !rnd.has(itemIdOf(i.id))),
    };
    // Cocktails are All's cocktails: R&D trials stay out here too.
    for (const f of TYPE_FILTERS) out[f.value] = published.filter((i) => i.category === f.category && !rnd.has(itemIdOf(i.id)));
    return out;
  }, [published, pricedIds, canCost, byMenu, shelves, kit]);
  const onNow = useMemo(() => new Set(byMenu.onNow), [byMenu]);
  const past = useMemo(() => new Set(byMenu.past), [byMenu]);
  // Preps by what was done to them (Syrups, Cordials...): the groups this venue has.
  const prepKinds = PREP_GROUPS.map((g) => ({ ...g, count: lists.preps.filter((p) => prepFacts[p.id]?.group === g.group).length })).filter((g) => g.count);
  const kind = show === 'preps' ? prepKinds.find((g) => g.value === params.kind) : undefined;
  const inView = lists[show].filter((i) => !kind || prepFacts[i.id]?.group === kind.group);
  const { lineOf } = useTileLines({ show, rndMenus: byMenu.rndMenus, prepLine: (id) => prepFacts[id]?.line ?? null, needsOf: kit.needsOf });
  const count = (value: Show) => (value === 'staff' ? classicRows(staff.data ?? [], linked.data ?? []).length : lists[value].length);
  const groups = filterGroups(!!activeId, canCost);

  // The On now card: the menu on now that started first (the bar's main list), and what comes after it.
  const tonight = useTonight(activeId);
  const lead = tonight.blocks[0] ?? null;
  const leadIds = lead ? lead.sections.flatMap((s) => s.drinks.map((d) => d.id)) : [];
  const next = useMemo(
    () =>
      groupMenus(
        (menus ?? []).filter((m) => m.barId === activeId),
        now
      ).upcoming[0] ?? null,
    [menus, activeId, now]
  );
  const card = lead ? { id: lead.menu.id, name: lead.menu.name, eyebrow: ['On now', menuDateLine(lead.menu, now, undefined, true)].filter(Boolean).join(' · '), sub: onNowSub(leadIds.length, next), ids: leadIds.slice(0, 3) } : null;
  // Tags: Off tonight (a planned take-off before close), else an allergen that changes the serve.
  const off = useMemo(
    () =>
      new Set(
        offTonight(
          tonight.blocks.flatMap((b) => b.sections.flatMap((s) => s.drinks)),
          new Date(now)
        ).map((d) => d.id)
      ),
    [tonight.blocks, now]
  );
  const drinkIds = capsule === 'drinks' ? inView.filter((i) => i.category === 'Cocktail').map((i) => i.id) : [];
  const allergens = useGuestDrinkAllergens(drinkIds).data;
  const tagOf = (i: SearchItem) => {
    if (off.has(itemIdOf(i.id))) return { label: 'Off tonight' };
    const tag = serviceTag((allergens?.get(i.id)?.allergens ?? []).map((a) => a.allergen));
    return tag ? { label: tag, warn: true } : null;
  };

  const pick = (value: Show) => setView({ show: value, menu: undefined, kind: undefined });
  return {
    active,
    activeId,
    venuesLoading,
    params,
    setView,
    show,
    capsule,
    pickCapsule: (c: StaffCapsule) => pick(CAPSULE_SHOW[c]),
    pick,
    chips: capsuleChips(groups, capsule),
    count,
    lists,
    published,
    inView,
    byMenu,
    onNow,
    past,
    prepKinds,
    kind,
    menus,
    capabilities,
    capsLoading,
    isLoading: venuesLoading || isLoading,
    staffLoading: staff.isLoading || linked.isLoading,
    error,
    lineOf,
    tagOf,
    card,
  };
}
