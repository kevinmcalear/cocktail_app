import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ensureIngredient } from '@/hooks/useCreateIngredient';
import { iceStartsFromKey, startIceRecipe } from '@/hooks/useIceRecipe';
import type { VenueIce, VenueIceChange } from '@/hooks/useVenueIce';

import { IceMadeStep, type IceMade } from './IceMadeStep';
import { iceRecipeHref } from './IceRecipeSection';

const NONE: IceMade = { way: null, from: null };

/**
 * Question 3 of Kit › Ice's Add sheet for ice made here (Kit and ice, step 6),
 * and what happens after the save: the way picked becomes the ice's starting
 * recipe, and its recipe page opens so the bar changes it to how it does it.
 * With no way picked the ice is just saved; its page asks later.
 */
export function useIceAddMade(barId: string, ices: readonly VenueIce[]) {
  const router = useRouter();
  const client = useQueryClient();
  const [made, setMade] = useState<IceMade>(NONE);

  const madeStep = () => <IceMadeStep value={made} onChange={setMade} others={ices} />;

  const onSaved = async (id: string, ice: VenueIceChange) => {
    const { way, from } = made;
    setMade(NONE);
    if (ice.source !== 'made' || !way) return;
    // A flavour typed by name is found, or added, the way the drink wizard does.
    const fromId = from ? (from.id ?? (await ensureIngredient({ id: null, name: from.name.trim() }, barId, new Map()))) : null;
    await startIceRecipe({ ...ice, id }, way, fromId);
    void client.invalidateQueries({ queryKey: ['item-prep', id] });
    void client.invalidateQueries({ queryKey: iceStartsFromKey(id) });
    void client.invalidateQueries({ queryKey: ['venue-ice-recipes'] });
    router.push(iceRecipeHref(barId, id));
  };

  return { madeStep, onSaved, reset: () => setMade(NONE) };
}
