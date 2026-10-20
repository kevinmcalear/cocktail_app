import { useItemFlavors, useMyTaste } from '@/hooks/useFlavor';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import type { DiscoverDrink, DrinkFilter } from '@/lib/discoverDrinks';
import { byTaste, FIRST_PAGE, pickShelves, topStyle, type Shelf } from '@/lib/discoverShelves';
import { areaLabel } from '@/lib/nearMe';

/**
 * Discover's shelves over the mixed list (lib/discoverShelves.ts): menus
 * around you, closest to your taste, then the style most bars here pour, and
 * zero-proof. The two extra lists are discover_list mixed and on now, asked
 * once the main list has painted (`around` has drinks), and saved like it.
 */
export function useDiscoverShelves(filter: DrinkFilter, around: DiscoverDrink[], enabled: boolean): Shelf[] {
  const ready = enabled && around.length > 0;
  const me = useMyTaste();
  const taste = me.data?.taste;
  const hasTaste = !!taste && Object.keys(taste).length > 0;
  // The first page only, so Show more never swaps which drinks the shelf picked.
  const page = around.slice(0, FIRST_PAGE);
  const flavors = useItemFlavors(
    page.map((d) => d.id),
    ready && hasTaste,
  );
  const style = ready ? topStyle(around) : null;
  const opts = { onNow: true, mix: true };
  const styled = useDiscoverList({ ...filter, kinds: style ? [style] : [] }, { ...opts, enabled: !!style });
  const zero = useDiscoverList({ ...filter, kinds: ['zero-proof'] }, { ...opts, enabled: ready });
  if (!ready) return [];
  const shelves = pickShelves({ where: areaLabel(filter.area), around, style, styled: styled.drinks, zero: zero.drinks });
  if (!hasTaste || !taste || !flavors.data) return shelves;
  return shelves.map((s) => (s.key === 'around' ? { ...s, drinks: byTaste(page, taste, flavors.data) } : s));
}
