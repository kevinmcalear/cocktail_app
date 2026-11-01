// What a menu page adds for the person looking (lib/menuLens): allergens and
// talking points for the floor, the method for bartenders, each drink's cost
// for the menu team, and the list's planned and waiting drinks for them.
import { useQuery } from '@tanstack/react-query';

import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useGuestDrinkAllergens, useMyAllergies } from '@/hooks/useGuestAllergies';
import { useListRows, type ListRow } from '@/hooks/useLivingList';
import { useMenuCosting } from '@/hooks/useMenuCosting';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { useUserId } from '@/ctx/AuthContext';
import { useViewAs } from '@/hooks/useViewAs';
import { allergenLabel, allergyMatches, type GuestDrinkAllergens } from '@/lib/allergens';
import { margin } from '@/lib/costing';
import { isMenuTeam, menuLens, methodLine, type MenuLens } from '@/lib/menuLens';
import { printedPrice } from '@/lib/menus';
import { priceMinor } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import type { MenuDetail } from '@/types/menus';

export interface RowNotes {
  /** A bartender's line: "Stirred · Nick & Nora · olive on a pick". */
  method: string | null;
  talkingPoint: string | null;
}

/** Method, garnish and talking point for each drink, read as the caller (the server keeps talking points from Employee up). */
function useRowNotes(itemIds: string[], barId: string | null, enabled: boolean, glassOf: (id: string) => string | null) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['menu-row-notes', barId, ids],
    enabled: enabled && !!barId && ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, RowNotes>> => {
      const [methods, notes] = await Promise.all([
        supabase.from('item_methods').select('item_id, sort_order, method:items!item_methods_method_item_id_fkey(name)').in('item_id', ids),
        supabase.from('item_service_notes').select('item_id, garnish, talking_point').in('item_id', ids),
      ]);
      if (methods.error) throw methods.error;
      if (notes.error) throw notes.error;
      const out: Record<string, RowNotes> = {};
      for (const id of ids) {
        const names = (methods.data ?? [])
          .filter((m) => m.item_id === id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((m) => (Array.isArray(m.method) ? m.method[0] : m.method)?.name)
          .filter((n): n is string => !!n);
        const note = (notes.data ?? []).find((n) => n.item_id === id);
        out[id] = { method: methodLine([...new Set(names)], glassOf(id), note?.garnish) || null, talkingPoint: note?.talking_point ?? null };
      }
      return out;
    },
  });
}

export interface MenuLensData {
  lens: MenuLens;
  /** Each drink's notes, by item id, once read. */
  notes: Record<string, RowNotes>;
  /** Each drink's allergen labels (the floor's chips), by item id; checked drinks only. */
  allergens: Map<string, string[]>;
  /** The guest's own allergies found per drink ("Egg"), by item id. */
  mine: Map<string, string[]>;
  /** "19% cost" per item id, for the menu team. */
  cost: Map<string, string>;
  /** The viewer may see costs (the costs permission, on the menu team). */
  costs: boolean;
  /** The average pour cost, "20%". */
  averageCost: string | null;
  /** The list's rows (planned and waiting drinks too), for the menu team. */
  rows: ListRow[];
}

/** Everything one menu page needs beyond the menu itself, for whoever is looking. */
export function useMenuLens(menu: MenuDetail | null | undefined): MenuLensData {
  const userId = useUserId();
  const barId = menu?.barId ?? null;
  const caps = useCapabilities(barId).data;
  const roleLevel = useActiveVenue().venues.find((v) => v.id === barId)?.roleLevel ?? null;
  const { viewAsRoleLevel } = useViewAs();
  const lens = menuLens({ barId, caps: Array.isArray(caps) ? caps : null, roleLevel, mine: !!menu && menu.createdBy === userId, viewAs: viewAsRoleLevel });
  const drinks = menu?.sections.flatMap((s) => s.drinks) ?? [];
  const ids = drinks.map((d) => d.id);
  const glass = new Map(drinks.map((d) => [d.id, d.glass]));

  const floor = lens !== 'guest' && lens !== 'home';
  const notes = useRowNotes(ids, barId, floor, (id) => glass.get(id) ?? null).data ?? {};
  const team = isMenuTeam(lens);
  const rows = useListRows(team ? menu?.id : null).data ?? [];

  // Allergens: every drink's for the floor; the guest's own matches for a guest who set some.
  const myAllergies = useMyAllergies().data ?? [];
  const wantAllergens = !!barId && (lens === 'employee' || (lens === 'guest' && myAllergies.length > 0));
  const declared = useGuestDrinkAllergens(wantAllergens ? ids : []).data;
  const allergens = new Map<string, string[]>();
  const mine = new Map<string, string[]>();
  declared?.forEach((d: GuestDrinkAllergens, id) => {
    if (!d.checked_at) return;
    allergens.set(id, d.allergens.map((a) => allergenLabel(a.allergen)));
    const hits = allergyMatches(myAllergies, d) ?? [];
    if (hits.length) mine.set(id, hits.map((h) => shortAllergen(h.allergen)));
  });

  // Cost: the menu team with the costs permission.
  const costs = team && Array.isArray(caps) && caps.includes('costs');
  const settings = usePricingSettings(costs ? barId : null).data;
  const costRows = useMenuCosting(menu?.id, barId, costs).data ?? [];
  const tax = { taxRate: settings?.tax_rate ?? 0, pricesIncludeTax: settings?.prices_include_tax ?? true };
  const cost = new Map<string, string>();
  const pcts: number[] = [];
  for (const r of costRows) {
    // A drink with no spec, or none of it priced, has no cost yet (not 0%).
    const total = r.cost && r.cost.total_minor > 0 ? r.cost.total_minor : null;
    const m = total == null ? null : margin(total, priceMinor(printedPrice(r), settings?.currency ?? null), tax);
    if (!m) continue;
    cost.set(r.id, `${Math.round(m.pourCost)}% cost`);
    pcts.push(m.pourCost);
  }
  const averageCost = pcts.length ? `${Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)}%` : null;

  return { lens, notes, allergens, mine, cost, costs, averageCost, rows };
}

/** "Egg" for a guest's row mark, the short form of the label. */
function shortAllergen(key: string): string {
  if (key === 'eggs') return 'Egg';
  if (key === 'gluten') return 'Gluten';
  if (key === 'tree_nuts') return 'Nuts';
  return allergenLabel(key);
}
