import { useState } from 'react';

import { GlassButton } from '@/components/ds';
import { useSignedIn } from '@/ctx/AuthContext';
import { useMadeDrinks } from '@/hooks/useMade';

import { useAgeGate } from '../safety/AgeGate';
import { MadeSheet } from './MadeSheet';

interface MadeActionProps {
  item: { id: string; name: string };
  ingredients: string[];
}

/** "I made it" on a drink page, saying how many times once you have. Signed in, after the age check. */
export function MadeAction({ item, ingredients }: MadeActionProps) {
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);
  const ageGate = useAgeGate();
  const times = (useMadeDrinks().data ?? []).filter((m) => m.itemId === item.id).length;
  if (!signedIn) return null;
  return (
    <>
      <GlassButton
        accessibilityLabel={times ? `I made it again. You've made ${item.name} ${times} times.` : `I made ${item.name} at home`}
        label={times ? `Made ×${times}` : 'I made it'}
        icon="house"
        onPress={() => ageGate.gate(() => setOpen(true))}
      />
      {open ? <MadeSheet item={item} ingredients={ingredients} onClose={() => setOpen(false)} /> : null}
      {ageGate.sheet}
    </>
  );
}
