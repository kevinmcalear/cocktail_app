import { useMemo } from 'react';

import { useVenueDrinks, useVenueKit } from '@/hooks/useKitCheck';
import { kitFromDrinks, type FromDrinks } from '@/lib/kitFromDrinks';

/** What next › From your drinks: what the venue's drinks name that isn't in its Kit. Null while it loads. */
export function useKitFromDrinks(barId: string | null | undefined): FromDrinks | null {
  const drinks = useVenueDrinks(barId).data;
  const kit = useVenueKit(barId);
  return useMemo(() => {
    if (!drinks || !kit) return null;
    return kitFromDrinks(drinks, {
      glasses: kit.glasses,
      ice: kit.ice,
      tools: kit.tools,
      iceSteps: [...kit.recipes].map(([id, r]) => ({ ice: kit.ice.find((i) => i.id === id)?.name ?? '', equipment: r.tools })),
    });
  }, [drinks, kit]);
}
