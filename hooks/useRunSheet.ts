import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { houseMadeUnder, purchasingFor, recipesFor, toLines } from '@/hooks/usePrepList';
import type { HouseMade, Purchasing } from '@/lib/prep';
import type { BrandBottle, ItemFacts, RunDrink, RunParty, RunSwap } from '@/lib/runSheet';
import { supabase } from '@/lib/supabase';

/**
 * A menu's run sheet (lib/runSheet.ts builds it from this): the menu's drinks
 * with their serves and specs (masked by role, like every recipe read), this
 * menu's swaps, its guest venue and brands, the owners someone picked, the
 * house preps under the drinks, pack sizes, and the brands' own bottles for
 * the "pour it everywhere" suggestion. Plain JSON, for the persisted cache.
 */
export interface RunSheetData {
  menu: { id: string; name: string; barId: string | null; createdBy: string | null; hostName: string; startsAt: string | null; endsAt: string | null };
  drinks: RunDrink[];
  swaps: RunSwap[];
  parties: (RunParty & { sortOrder: number })[];
  owners: Record<string, string | null>;
  houseMade: Record<string, HouseMade>;
  purchasing: Record<string, Purchasing>;
  items: Record<string, ItemFacts & { name: string }>;
  brandBottles: BrandBottle[];
}

export const runSheetKey = (menuId: string, userId: string | null) => ['run-sheet', menuId, userId] as const;

interface MenuRow {
  id: string;
  name: string;
  bar_id: string | null;
  created_by: string | null;
  starts_at: string | null;
  ends_at: string | null;
  planned_starts_at: string | null;
  planned_ends_at: string | null;
  menu_date: string | null;
  bar: { name: string } | null;
}
interface DrinkRow {
  id: string;
  serves: number | null;
  item: { id: string; name: string; item_type: string; glassware_id: string | null; ice_id: string | null; ice_per_serve_g: number | null; bar_id: string | null; origin_bar_profile_id: string | null } | null;
}
interface FactRow {
  id: string;
  name: string;
  maker_profile_id: string | null;
  ingredient_role: string | null;
  abv: number | null;
  generic_id: string | null;
  generic: { name: string } | null;
}

const FACTS = 'id, name, maker_profile_id, ingredient_role, abv, generic_id, generic:generic_id(name)';

async function factsFor(ids: string[]): Promise<Record<string, ItemFacts & { name: string }>> {
  const out: Record<string, ItemFacts & { name: string }> = {};
  // ponytail: 150 ids a request keeps the URL short; a menu rarely needs two.
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase.from('items').select(FACTS).in('id', ids.slice(i, i + 150));
    if (error) throw error;
    for (const r of (data ?? []) as unknown as FactRow[]) {
      out[r.id] = { name: r.name, makerProfileId: r.maker_profile_id, role: r.ingredient_role, abv: r.abv, kind: r.generic?.name ?? null, genericId: r.generic_id };
    }
  }
  return out;
}

async function fetchRunSheet(menuId: string): Promise<RunSheetData> {
  const [menuRes, drinkRes, partyRes, ownerRes] = await Promise.all([
    supabase.from('menus').select('id, name, bar_id, created_by, starts_at, ends_at, planned_starts_at, planned_ends_at, menu_date, bar:bars(name)').eq('id', menuId).single(),
    supabase
      .from('menu_drinks')
      .select('id, serves, item:items!item_id(id, name, item_type, glassware_id, ice_id, ice_per_serve_g, bar_id, origin_bar_profile_id)')
      .eq('menu_id', menuId)
      .order('sort_order'),
    supabase.from('menu_run_parties').select('id, kind, name, profile_id, sort_order, profile:profiles!profile_id(bar_id)').eq('menu_id', menuId).order('sort_order'),
    supabase.from('menu_run_owners').select('item_id, party_id').eq('menu_id', menuId),
  ]);
  for (const res of [menuRes, drinkRes, partyRes, ownerRes]) if (res.error) throw res.error;
  const menu = menuRes.data as unknown as MenuRow;
  // A home menu's collected drinks come through published_items, not items: they have no spec to total here.
  const rows = ((drinkRes.data ?? []) as unknown as DrinkRow[]).filter((r) => r.item);
  type PartyRow = { id: string; kind: 'guest' | 'brand'; name: string; profile_id: string | null; sort_order: number; profile: { bar_id: string | null } | null };
  const partyRows = (partyRes.data ?? []) as unknown as PartyRow[];
  const guest = partyRows.find((p) => p.kind === 'guest');

  const cocktailIds = [...new Set(rows.filter((r) => r.item!.item_type === 'cocktail').map((r) => r.item!.id))];
  const [recipeRows, swapRes] = await Promise.all([
    recipesFor(cocktailIds),
    rows.length ? supabase.from('menu_run_swaps').select('menu_drink_id, from_item_id, to_item_id').in('menu_drink_id', rows.map((r) => r.id)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (swapRes.error) throw swapRes.error;
  const swapRows = (swapRes.data ?? []) as { menu_drink_id: string; from_item_id: string; to_item_id: string }[];

  const recipes = new Map(cocktailIds.map((id) => [id, toLines(recipeRows, id)]));
  const ingredientIds = [...new Set([...[...recipes.values()].flatMap((lines) => lines.map((l) => l.ingredientId)), ...swapRows.map((s) => s.to_item_id)])];
  const { houseMade, leaves } = await houseMadeUnder(ingredientIds, new Set(cocktailIds));
  const kitIds = rows.flatMap((r) => [r.item!.glassware_id, r.item!.ice_id]).filter((id): id is string => !!id);
  const brandProfiles = partyRows.filter((p) => p.kind === 'brand' && p.profile_id).map((p) => p.profile_id!);
  const [purchasing, items, bottleRes] = await Promise.all([
    menu.bar_id ? purchasingFor(menu.bar_id, leaves) : Promise.resolve({}),
    factsFor([...new Set([...ingredientIds, ...kitIds, ...Object.keys(houseMade), ...leaves])]),
    brandProfiles.length
      ? supabase.from('items').select('id, name, maker_profile_id, generic_id, generic:generic_id(name)').eq('item_type', 'ingredient').in('maker_profile_id', brandProfiles).order('name').limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (bottleRes.error) throw bottleRes.error;

  const named = (id: string | null) => (id && items[id] ? { id, name: items[id].name } : null);
  const drinks: RunDrink[] = rows.map((r) => {
    const item = r.item!;
    return {
      id: r.id,
      itemId: item.id,
      name: item.name,
      itemType: item.item_type,
      serves: r.serves,
      recipe: recipes.get(item.id) ?? [],
      glass: named(item.glassware_id),
      ice: named(item.ice_id),
      icePerServeG: item.ice_per_serve_g,
      byGuest: !!guest && ((!!guest.profile_id && item.origin_bar_profile_id === guest.profile_id) || (!!guest.profile?.bar_id && item.bar_id === guest.profile.bar_id)),
    };
  });
  type BottleRow = { id: string; name: string; maker_profile_id: string; generic_id: string | null; generic: { name: string } | null };
  const brandBottles: BrandBottle[] = ((bottleRes.data ?? []) as unknown as BottleRow[]).flatMap((b) => {
    const party = partyRows.find((p) => p.kind === 'brand' && p.profile_id === b.maker_profile_id);
    return party ? [{ id: b.id, name: b.name, genericId: b.generic_id, kindName: b.generic?.name ?? null, partyId: party.id }] : [];
  });

  return {
    menu: {
      id: menu.id,
      name: menu.name,
      barId: menu.bar_id,
      createdBy: menu.created_by,
      hostName: menu.bar?.name ?? 'You',
      startsAt: menu.planned_starts_at ?? menu.starts_at ?? menu.menu_date,
      endsAt: menu.planned_ends_at ?? menu.ends_at,
    },
    drinks,
    swaps: swapRows.map((s) => ({ menuDrinkId: s.menu_drink_id, fromItemId: s.from_item_id, toItemId: s.to_item_id, toName: items[s.to_item_id]?.name ?? 'Another bottle' })),
    parties: partyRows.map((p) => ({ id: p.id, kind: p.kind, name: p.name, profileId: p.profile_id, sortOrder: p.sort_order })),
    owners: Object.fromEntries(((ownerRes.data ?? []) as { item_id: string; party_id: string | null }[]).map((o) => [o.item_id, o.party_id])),
    houseMade,
    purchasing,
    items,
    brandBottles,
  };
}

export function useRunSheet(menuId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: runSheetKey(menuId ?? '', userId),
    enabled: !!menuId && !!userId,
    queryFn: () => fetchRunSheet(menuId!),
  });
}

function check<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw new Error(res.error.message);
  return res;
}

/**
 * Run sheet writes. Each patches the cached sheet at once (serves are typed
 * fast) and refetches after, so totals and defaults come from the server.
 */
function useRunSheetWrite<V>(menuId: string, write: (v: V) => Promise<unknown>, patch: (data: RunSheetData, v: V) => RunSheetData) {
  const queryClient = useQueryClient();
  const key = runSheetKey(menuId, useUserId());
  return useMutation({
    mutationFn: write,
    onMutate: async (v: V) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<RunSheetData>(key);
      if (before) queryClient.setQueryData<RunSheetData>(key, patch(before, v));
      return { before };
    },
    onError: (_e, _v, ctx) => ctx?.before && queryClient.setQueryData(key, ctx.before),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['run-sheet', menuId] }),
  });
}

/** Serves for some of the menu's drinks (null clears them). */
export function useSetServes(menuId: string) {
  return useRunSheetWrite<{ menuDrinkIds: string[]; serves: number | null }>(
    menuId,
    async ({ menuDrinkIds, serves }) => check(await supabase.from('menu_drinks').update({ serves }).in('id', menuDrinkIds)),
    (data, { menuDrinkIds, serves }) => ({ ...data, drinks: data.drinks.map((d) => (menuDrinkIds.includes(d.id) ? { ...d, serves } : d)) }),
  );
}

export interface SwapChange {
  menuDrinkId: string;
  fromItemId: string;
  /** Null puts the library's bottle back. */
  to: { id: string; name: string } | null;
}

/** Swaps for this menu only: one line, or every line a suggestion found. */
export function useSetSwaps(menuId: string) {
  return useRunSheetWrite<SwapChange[]>(
    menuId,
    async (changes) => {
      const set = changes.filter((c) => c.to && c.to.id !== c.fromItemId);
      const clear = changes.filter((c) => !c.to || c.to.id === c.fromItemId);
      if (set.length) {
        const rows = set.map((c) => ({ menu_drink_id: c.menuDrinkId, from_item_id: c.fromItemId, to_item_id: c.to!.id }));
        check(await supabase.from('menu_run_swaps').upsert(rows, { onConflict: 'menu_drink_id,from_item_id' }));
      }
      for (const c of clear) check(await supabase.from('menu_run_swaps').delete().eq('menu_drink_id', c.menuDrinkId).eq('from_item_id', c.fromItemId));
    },
    (data, changes) => {
      const touched = (s: RunSwap) => changes.some((c) => c.menuDrinkId === s.menuDrinkId && c.fromItemId === s.fromItemId);
      const added = changes.filter((c) => c.to && c.to.id !== c.fromItemId).map((c) => ({ menuDrinkId: c.menuDrinkId, fromItemId: c.fromItemId, toItemId: c.to!.id, toName: c.to!.name }));
      return { ...data, swaps: [...data.swaps.filter((s) => !touched(s)), ...added] };
    },
  );
}

export interface PartyInput {
  /** Set to rename or relink one; leave out to add. */
  id?: string;
  kind: 'guest' | 'brand';
  name: string;
  profileId: string | null;
  /** Where a new one goes in the list: after the others. */
  sortOrder?: number;
}

/** Adds or changes the guest venue or a brand. */
export function useSaveParty(menuId: string) {
  return useRunSheetWrite<PartyInput>(
    menuId,
    async (p) => {
      const row = { kind: p.kind, name: p.name.trim(), profile_id: p.profileId };
      if (p.id) check(await supabase.from('menu_run_parties').update(row).eq('id', p.id));
      else check(await supabase.from('menu_run_parties').insert({ ...row, menu_id: menuId, sort_order: p.sortOrder ?? 0 }));
    },
    (data, p) =>
      p.id ? { ...data, parties: data.parties.map((x) => (x.id === p.id ? { ...x, name: p.name, kind: p.kind, profileId: p.profileId } : x)) } : data,
  );
}

/** Takes a guest venue or a brand off the sheet; what it brought goes back to the host. */
export function useRemoveParty(menuId: string) {
  return useRunSheetWrite<string>(
    menuId,
    async (id) => check(await supabase.from('menu_run_parties').delete().eq('id', id)),
    (data, id) => ({
      ...data,
      parties: data.parties.filter((p) => p.id !== id),
      owners: Object.fromEntries(Object.entries(data.owners).map(([item, party]) => [item, party === id ? null : party])),
    }),
  );
}

/** Who brings some things: a party, null for the host, or 'default' to go back to the sheet's guess. */
export function useSetOwners(menuId: string) {
  return useRunSheetWrite<{ itemIds: string[]; partyId: string | null | 'default' }>(
    menuId,
    async ({ itemIds, partyId }) => {
      if (!itemIds.length) return;
      if (partyId === 'default') check(await supabase.from('menu_run_owners').delete().eq('menu_id', menuId).in('item_id', itemIds));
      else check(await supabase.from('menu_run_owners').upsert(itemIds.map((item_id) => ({ menu_id: menuId, item_id, party_id: partyId, updated_at: new Date().toISOString() }))));
    },
    (data, { itemIds, partyId }) => {
      const owners = { ...data.owners };
      for (const id of itemIds) {
        if (partyId === 'default') delete owners[id];
        else owners[id] = partyId;
      }
      return { ...data, owners };
    },
  );
}

export interface PartyPage {
  id: string;
  display_name: string;
  handle: string;
}

/** Pages to link a party to: bars for the guest venue, makers for a brand. */
export function usePartySearch(term: string, kind: 'guest' | 'brand') {
  const q = term.trim();
  return useQuery({
    queryKey: ['run-sheet-party-search', kind, q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<PartyPage[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, handle')
        .eq('kind', kind === 'guest' ? 'bar' : 'maker')
        .ilike('display_name', `%${q.replace(/[\\%_]/g, '\\$&')}%`)
        .order('display_name')
        .limit(8);
      if (error) throw error;
      return (data ?? []) as PartyPage[];
    },
  });
}
