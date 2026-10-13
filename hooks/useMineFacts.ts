import { useMemo, useState } from 'react';

import { useVenueMenus } from '@/hooks/useMenus';
import { useStaffList } from '@/hooks/useStaffList';
import { useVenueShelves } from '@/hooks/useVenueShelves';
import type { MineFacts } from '@/lib/searchCaptions';
import type { SearchItem } from '@/types/search';

/**
 * What the venue's search rows need to say why each is here: its menus, its
 * staff list, which drinks use each ingredient and which are house preps
 * (lib/searchCaptions.ts). The same cached queries the Library reads.
 */
export function useMineFacts(venueId: string | null, items: readonly SearchItem[]): MineFacts {
  const { data: menus } = useVenueMenus(venueId);
  const { data: staff } = useStaffList(venueId);
  const published = useMemo(() => items.filter((i) => !i.isDraft), [items]);
  const shelves = useVenueShelves(venueId, published);
  const [now] = useState(() => Date.now());
  return useMemo(() => {
    const usedIn = new Map<string, string[]>();
    for (const d of published) {
      if (d.category !== 'Cocktail') continue;
      for (const r of d.recipes ?? []) {
        const id = r.display_ingredient_id ?? r.ingredient_item_id;
        if (!id) continue;
        const list = usedIn.get(id) ?? [];
        if (!list.includes(d.id)) list.push(d.id);
        usedIn.set(id, list);
      }
    }
    return {
      menus: (menus ?? []).filter((m) => m.barId === venueId && m.kind !== 'rnd'),
      now,
      staff: [...(staff ?? [])].filter((p) => p.rank !== null).sort((a, b) => a.rank! - b.rank!).map((p) => p.itemId),
      unranked: (staff ?? []).filter((p) => p.rank === null).map((p) => p.itemId),
      usedIn,
      preps: new Set(shelves.preps.map((p) => p.id)),
    };
  }, [menus, staff, published, shelves, venueId, now]);
}
