import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { useFlavorCatalog } from '@/hooks/useFlavor';
import { chunk } from '@/lib/commandSearchGrid';
import { useTrackSearch } from '@/hooks/useTrackSearch';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { menuOrder, runDates, searchMenuTag, type MenuRunRow } from '@/lib/menuEditions';
import { filterDrinks, toDiscoverDrink, type DiscoverBar, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import { noteDimension } from '@/lib/flavor';
import { supabase } from '@/lib/supabase';

const PAGE = 1000;

interface DrinkRow {
  id: string;
  name: string;
  description: string | null;
  origin_bar_profile_id: string;
  riff_of: { name: string } | null;
  recipes: { display_ingredient_id: string | null }[] | null;
  item_images: ItemImageLink[] | null;
}

/**
 * Every public bar's drinks, with their bar, styles and spirits: what
 * Discover searches, filters by area and pins on the map. Signed-in only,
 * like every shared drink.
 * ponytail: loads the whole set (about 7,000 drinks, a few MB) once and
 * filters on the device. Upgrade path: a discover_drinks RPC that filters by
 * area and style in SQL; at 7,000 drinks it's due.
 */
export function useDiscoverDrinks() {
  const signedIn = !!useAuth().user;
  return useQuery({
    queryKey: ['discover-drinks'],
    // Too big to save between launches (lib/queryCachePersist.ts).
    meta: { persist: false },
    enabled: signedIn,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<{ drinks: DiscoverDrink[]; bars: DiscoverBar[] }> => {
      const [bars, runs, rows] = await Promise.all([readBars(), readMenuRuns(), readBarDrinks()]);
      const names = await readNames([...new Set(rows.flatMap((r) => (r.recipes ?? []).map((x) => x.display_ingredient_id)))].filter((id): id is string => !!id));
      const byId = new Map(bars.map((b) => [b.id, b]));
      const drinks: DiscoverDrink[] = [];
      for (const r of rows) {
        const bar = byId.get(r.origin_bar_profile_id);
        if (!bar) continue; // A closed or hidden bar's drinks stay off Discover.
        drinks.push(
          toDiscoverDrink({
            id: r.id,
            name: r.name,
            description: r.description,
            riffOf: r.riff_of?.name ?? null,
            ingredients: (r.recipes ?? []).map((x) => (x.display_ingredient_id ? names.get(x.display_ingredient_id) : undefined)).filter((n): n is string => !!n),
            imageUrl: heroPicture(r.item_images)?.url ?? null,
            barId: bar.id,
            menu: menuOf(runs.get(r.id)),
          })
        );
      }
      return { drinks, bars };
    },
  });
}

/**
 * Every bar drink, a page at a time. Pages start after the last id rather than
 * at an offset, so each costs the same (an offset page redoes every row
 * before it, and the last ones neared the 8 s statement timeout when prod was
 * busy). Ingredient ids only: the display_ingredient embed runs a function per
 * recipe line; readNames fetches the names by id instead.
 */
async function readBarDrinks(): Promise<DrinkRow[]> {
  const rows: DrinkRow[] = [];
  for (;;) {
    let page = supabase
      .from('items')
      .select(
        'id, name, description, origin_bar_profile_id, riff_of:riff_of_id ( name ), recipes:app_recipe_presentation!recipe_item_id ( display_ingredient_id ), item_images ( angle, sort_order, is_generated, images ( url ) )'
      )
      .eq('item_type', 'cocktail')
      .is('bar_id', null)
      .not('origin_bar_profile_id', 'is', null);
    if (rows.length) page = page.gt('id', rows[rows.length - 1].id);
    const { data, error } = await page.order('id').limit(PAGE);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as DrinkRow[]));
    if ((data ?? []).length < PAGE) return rows;
  }
}

/** Ingredient names by id, in URL-sized batches loaded together. */
async function readNames(ids: string[]): Promise<Map<string, string>> {
  const batches = await Promise.all(
    chunk(ids, 150).map(async (batch) => {
      const { data, error } = await supabase.from('items').select('id, name').in('id', batch);
      if (error) throw error;
      return data ?? [];
    })
  );
  return new Map(batches.flat().map((i) => [i.id, i.name]));
}

async function readBars(): Promise<DiscoverBar[]> {
  const bars: DiscoverBar[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, handle, display_name, avatar_url, locality, city, country_code, latitude, longitude')
      .eq('kind', 'bar')
      .eq('is_public', true)
      .eq('is_closed', false)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const p of data ?? []) {
      bars.push({
        id: p.id,
        handle: p.handle,
        name: p.display_name,
        logo: p.avatar_url,
        locality: p.locality,
        city: p.city,
        countryCode: p.country_code,
        latitude: p.latitude,
        longitude: p.longitude,
      });
    }
    if ((data ?? []).length < PAGE) break;
  }
  return bars;
}

/**
 * When each bar drink was on its bar's menus (menu_drink_runs), by drink.
 * ponytail: a few thousand short rows read with the drinks; fold them into a
 * discover_drinks RPC with the rest when that lands.
 */
async function readMenuRuns(): Promise<Map<string, MenuRunRow>> {
  const runs = new Map<string, MenuRunRow>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('menu_drink_runs')
      .select('item_id, start_year, start_month, end_year, end_month, is_current')
      .order('item_id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const r of (data ?? []) as (MenuRunRow & { item_id: string })[]) runs.set(r.item_id, r);
    if ((data ?? []).length < PAGE) break;
  }
  return runs;
}

/** Plain JSON for the persisted cache: on now, or past with its dates, and where it sorts. */
function menuOf(run: MenuRunRow | undefined): DiscoverDrink['menu'] {
  const dates = run ? runDates(run) : null;
  const tag = searchMenuTag(dates);
  return { onNow: !!tag?.onNow, past: tag?.past ?? null, order: menuOrder(dates) };
}

/**
 * The drinks at bars that match Discover's filter, and the bars behind them.
 * Empty (not loading) when signed out: shared drinks need an account.
 */
export function useDiscoverResults(filter: DrinkFilter) {
  const query = useDiscoverDrinks();
  useTrackSearch(filter.search, 'discover');
  const catalog = useFlavorCatalog();
  const bars = query.data?.bars ?? [];
  const barsById = new Map(bars.map((b) => [b.id, b]));
  const note = filter.kinds.some((k) => !!noteDimension(k));
  const profiles = note ? new Map((catalog.data ?? []).map((d) => [d.id, d.profile])) : undefined;
  const drinks = query.data ? filterDrinks(query.data.drinks, barsById, profiles ? { ...filter, profiles } : filter) : [];
  return { drinks, bars, barsById, isLoading: query.isLoading || (note && catalog.isLoading), error: query.error };
}
