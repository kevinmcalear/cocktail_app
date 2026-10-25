
import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useBarKit } from '@/hooks/useBarKit';
import { useVenueIce } from '@/hooks/useVenueIce';
import { useIceRecipes, useVenueDrinks } from '@/hooks/useKitCheck';
import { kitFromDrinks, type FromDrinks } from '@/lib/kitFromDrinks';

/** What next › From your drinks: what the venue's drinks name that isn't in its Kit. Null while it loads. */
export function useKitFromDrinks(barId: string | null | undefined): FromDrinks | null {
  const drinks = useVenueDrinks(barId).data;
  const glasses = useBarGlassware(barId).data;
  const ice = useVenueIce(barId).data;
  const tools = useBarKit(barId).data;
  const steps = useIceRecipes(barId, (ice ?? []).filter((i) => i.source === 'made').map((i) => i.id)).data;
  if (!drinks || !glasses || !ice || !tools) return null;
  return kitFromDrinks(drinks, {
    glasses,
    ice,
    tools: tools.flatMap((t) => (t.key ? [t.key] : [])),
    iceSteps: (steps ?? []).map((r) => ({ ice: ice.find((i) => i.id === r.id)?.name ?? '', equipment: r.tools })),
  });
}
