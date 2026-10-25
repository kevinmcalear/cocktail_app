import { useQuery } from '@tanstack/react-query';

import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useBarKit } from '@/hooks/useBarKit';
import { useVenueIce } from '@/hooks/useVenueIce';
import { kitFromDrinks, type DrinkKit, type FromDrinks } from '@/lib/kitFromDrinks';
import { supabase } from '@/lib/supabase';

/** The venue's drinks' glasses, ice and methods by name. */
function useVenueDrinkKit(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['venue-drink-kit', barId],
    enabled: !!barId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<DrinkKit[]> => {
      // ponytail: one page of a venue's drinks; past 1000 the rest aren't counted. A count RPC if a venue gets there.
      const { data, error } = await supabase
        .from('items')
        .select('glass:glassware_id(name), ice:ice_id(name), item_methods!item_methods_item_id_fkey(method:method_item_id(name))')
        .eq('bar_id', barId!)
        .eq('item_type', 'cocktail')
        .limit(1000);
      if (error) throw error;
      type Row = { glass: { name: string } | null; ice: { name: string } | null; item_methods: { method: { name: string } | null }[] };
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        glass: r.glass?.name ?? null,
        ice: r.ice?.name ?? null,
        methods: r.item_methods.flatMap((m) => (m.method ? [m.method.name] : [])),
      }));
    },
  });
}

/** The tools the venue's own ice recipes name, per ice. */
function useVenueIceSteps(barId: string | null | undefined, ice: readonly { id: string; name: string }[]) {
  const ids = ice.map((i) => i.id);
  return useQuery({
    queryKey: ['venue-ice-steps', barId, ids],
    enabled: !!barId && ids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('item_steps').select('item_id, equipment').in('item_id', ids);
      if (error) throw error;
      return ice.map((i) => ({ ice: i.name, equipment: (data ?? []).filter((s) => s.item_id === i.id).flatMap((s) => s.equipment) }));
    },
  });
}

/** What next › From your drinks: what the venue's drinks name that isn't in its Kit. Null while it loads. */
export function useKitFromDrinks(barId: string | null | undefined): FromDrinks | null {
  const drinks = useVenueDrinkKit(barId).data;
  const glasses = useBarGlassware(barId).data;
  const ice = useVenueIce(barId).data;
  const tools = useBarKit(barId).data;
  const steps = useVenueIceSteps(barId, ice ?? []).data;
  if (!drinks || !glasses || !ice || !tools) return null;
  return kitFromDrinks(drinks, {
    glasses,
    ice,
    tools: tools.flatMap((t) => (t.key ? [t.key] : [])),
    iceSteps: steps ?? [],
  });
}
