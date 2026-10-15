import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import type { DiscoverDrink, DrinkFilter } from '@/lib/discoverDrinks';
import { pickShelves, topStyle, type Shelf } from '@/lib/discoverShelves';
import { areaLabel } from '@/lib/nearMe';

/**
 * Discover's shelves over the mixed list (lib/discoverShelves.ts): its first
 * round, the style most bars here pour, and zero-proof. The two extra lists
 * are discover_list mixed and on now, asked once the main list has painted
 * (`around` has drinks), and saved like it.
 */
export function useDiscoverShelves(filter: DrinkFilter, around: DiscoverDrink[], enabled: boolean): Shelf[] {
  const ready = enabled && around.length > 0;
  const style = ready ? topStyle(around) : null;
  const opts = { onNow: true, mix: true };
  const styled = useDiscoverList({ ...filter, kinds: style ? [style] : [] }, { ...opts, enabled: !!style });
  const zero = useDiscoverList({ ...filter, kinds: ['zero-proof'] }, { ...opts, enabled: ready });
  if (!ready) return [];
  return pickShelves({ where: areaLabel(filter.area), around, style, styled: styled.drinks, zero: zero.drinks });
}
