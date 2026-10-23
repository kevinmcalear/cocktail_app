import { useQuery } from '@tanstack/react-query';

import { fetchPublished, type PublishedDrink } from '@/hooks/usePublished';
import { resolveShareKey } from '@/hooks/useShareSlug';
import type { IngredientName } from '@/lib/publicDrink';
import { jsonAs, supabase } from '@/lib/supabase';

/** A home menu someone shared, as anyone reads it: /m/<id> or /m/<slug>. */
export interface SharedMenuPage {
  id: string;
  name: string;
  menuDate: string | null;
  coverUrl: string | null;
  owner: { profileId: string; name: string; handle: string };
  /** Each entry is a public drink, or null for one that isn't public (its name stays private). */
  sections: { id: string; name: string; drinks: (PublishedDrink | null)[] }[];
  /** Each public drink's ingredient names, never amounts, by drink id. */
  ingredients: Record<string, IngredientName[]>;
}

interface SharedMenuRow {
  id: string;
  name: string;
  menu_date: string | null;
  cover_url: string | null;
  owner: { profile_id: string; name: string; handle: string };
  sections: { id: string; name: string; item_ids: (string | null)[] }[];
}

/**
 * A shared home menu, or null when it isn't shared (any more), or its owner
 * isn't public, or one of you blocked the other. shared_menu() only returns
 * ids of drinks the caller could already see; the cards come from
 * published_items like every other public page. Works signed out.
 */
export function useSharedMenu(id: string | null | undefined) {
  return useQuery({
    queryKey: ['published', 'menu', id],
    meta: { public: true },
    enabled: !!id,
    queryFn: async (): Promise<SharedMenuPage | null> => {
      // The id or the readable slug (/m/halloween-party). A mangled link is Not available, not a failed load.
      const menuId = id ? await resolveShareKey('m', id) : null;
      if (!menuId) return null;
      const { data, error } = await supabase.rpc('shared_menu', { p_menu_id: menuId });
      if (error) throw error;
      if (!data) return null;
      const row = jsonAs<SharedMenuRow>(data);
      const ids = row.sections.flatMap((s) => s.item_ids).filter((x): x is string => !!x);
      const [drinks, names] = await Promise.all([fetchPublished(ids), ids.length ? supabase.rpc('public_drink_ingredients', { p_item_ids: ids }) : Promise.resolve({ data: [], error: null })]);
      if (names.error) throw names.error;
      const ingredients: Record<string, IngredientName[]> = {};
      for (const n of (names.data ?? []) as (IngredientName & { item_id: string })[]) (ingredients[n.item_id] ??= []).push({ name: n.name, brand: n.brand });
      return {
        id: row.id,
        name: row.name,
        menuDate: row.menu_date,
        coverUrl: row.cover_url,
        owner: { profileId: row.owner.profile_id, name: row.owner.name, handle: row.owner.handle },
        sections: row.sections.map((s) => ({
          id: s.id,
          name: s.name,
          drinks: s.item_ids.map((itemId) => drinks.find((d) => d.id === itemId) ?? null),
        })),
        ingredients,
      };
    },
  });
}
