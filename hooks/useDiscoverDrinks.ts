import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { useFlavorCatalog } from '@/hooks/useFlavor';
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
  recipes: { display_ingredient: { name: string } | null }[] | null;
  item_images: ItemImageLink[] | null;
}

/**
 * Every public bar's drinks, with their bar, styles and spirits: what
 * Discover searches, filters by area and pins on the map. Signed-in only,
 * like every shared drink.
 * ponytail: loads the whole set (about 1,600 drinks, ~0.5 MB) once and
 * filters on the device. Upgrade path: a discover_drinks RPC that filters by
 * area and style in SQL, once there are several thousand.
 */
export function useDiscoverDrinks() {
  const signedIn = !!useAuth().user;
  return useQuery({
    queryKey: ['discover-drinks'],
    enabled: signedIn,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<{ drinks: DiscoverDrink[]; bars: DiscoverBar[] }> => {
      const [bars, runs] = await Promise.all([readBars(), readMenuRuns()]);
      const byId = new Map(bars.map((b) => [b.id, b]));
      const drinks: DiscoverDrink[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('items')
          .select(
            'id, name, description, origin_bar_profile_id, riff_of:riff_of_id ( name ), recipes:app_recipe_presentation!recipe_item_id ( display_ingredient ( name ) ), item_images ( angle, sort_order, is_generated, images ( url ) )'
          )
          .eq('item_type', 'cocktail')
          .is('bar_id', null)
          .not('origin_bar_profile_id', 'is', null)
          .order('id')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as unknown as DrinkRow[];
        for (const r of rows) {
          const bar = byId.get(r.origin_bar_profile_id);
          if (!bar) continue; // A closed or hidden bar's drinks stay off Discover.
          drinks.push(
            toDiscoverDrink({
              id: r.id,
              name: r.name,
              description: r.description,
              riffOf: r.riff_of?.name ?? null,
              ingredients: (r.recipes ?? []).map((x) => x.display_ingredient?.name).filter((n): n is string => !!n),
              imageUrl: heroPicture(r.item_images)?.url ?? null,
              barId: bar.id,
              menu: menuOf(runs.get(r.id)),
            })
          );
        }
        if (rows.length < PAGE) break;
      }
      return { drinks, bars };
    },
  });
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
  const catalog = useFlavorCatalog();
  const bars = query.data?.bars ?? [];
  const barsById = new Map(bars.map((b) => [b.id, b]));
  const note = filter.kinds.some((k) => !!noteDimension(k));
  const profiles = note ? new Map((catalog.data ?? []).map((d) => [d.id, d.profile])) : undefined;
  const drinks = query.data ? filterDrinks(query.data.drinks, barsById, profiles ? { ...filter, profiles } : filter) : [];
  return { drinks, bars, barsById, isLoading: query.isLoading || (note && catalog.isLoading), error: query.error };
}
