import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useSignedIn } from '@/ctx/AuthContext';
import { useMadeDrinks } from '@/hooks/useMade';
import type { ItemPicture } from '@/lib/itemImages';
import type { SpecLine } from '@/lib/spec';

import { MadeSheet } from '../made/MadeSheet';
import { RankFlow } from '../rank/RankActions';
import { useAgeGate } from '../safety/AgeGate';

interface ActionItem {
  id: string;
  name: string;
  bar_id: string | null;
}

/**
 * Rank it and I made it for a drink page, so the pinned bar and the journey
 * strip open the same sheets. Both need a confirmed age; signed out, they ask
 * you to sign in. Render `sheets`.
 */
export function useDrinkActions(item: ActionItem, picture: ItemPicture | null, lines: SpecLine[], barName: string | null = null) {
  const ingredients = lines.flatMap((l) => (l.ingredient ? [l.ingredient] : []));
  const router = useRouter();
  const signedIn = useSignedIn();
  const ageGate = useAgeGate();
  const [open, setOpen] = useState<'rank' | 'made' | null>(null);
  const madeTimes = (useMadeDrinks().data ?? []).filter((m) => m.itemId === item.id).length;
  const start = (sheet: 'rank' | 'made') => (signedIn ? ageGate.gate(() => setOpen(sheet)) : router.push('/auth/login'));
  return {
    rank: () => start('rank'),
    made: () => start('made'),
    madeTimes,
    sheets: (
      <>
        {open === 'rank' ? <RankFlow item={item} picture={picture} onClose={() => setOpen(null)} /> : null}
        {open === 'made' ? <MadeSheet item={item} ingredients={ingredients} lines={lines} barName={barName} onClose={() => setOpen(null)} /> : null}
        {ageGate.sheet}
      </>
    ),
  };
}

export type DrinkActions = ReturnType<typeof useDrinkActions>;
