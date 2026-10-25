import { useState } from 'react';

import { useNearNameDrink } from '@/hooks/useNearNameDrink';
import { useSaveSpelling } from '@/hooks/useSearchNear';
import { withArticle } from '@/lib/closestClassic';
import type { WizardDraft } from '@/lib/drinkWizard';
import { sameName } from '@/lib/sameName';

import { SameNameCard, useSameNamePicks } from './SameNameCard';

interface Props {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  barId: string | null;
  venueName: string | null;
  /** Something else is already shown for the name: the bar's drink by that very name, or a classic. */
  hidden: boolean;
  /** Desktop: the drink beside the heading, the choices in a row. */
  wide?: boolean;
  /** After Make our version fills the spec in: on to the ingredients. */
  onStarted?: () => void;
}

/**
 * "Is it the Salti Boi from Pale Moth?" (whole-app canvas, Search page, 3A):
 * the name step's same-name card for a close spelling, at the venue or
 * anywhere. Yes opens that drink and keeps the spelling, so search finds it
 * next time (public.save_spelling); Make our version starts from its spec
 * (just links it when the spec can't be read); No keeps the name as typed
 * and stops asking about that drink. It asks; nothing waits on it.
 */
export function NearNameCard({ draft, set, barId, venueName, hidden, wide, onStarted }: Props) {
  const picks = useSameNamePicks(set);
  const save = useSaveSpelling();
  const [notThese, setNotThese] = useState<string[]>([]);
  const near = useNearNameDrink({ barId, venueName, name: draft.name, enabled: !hidden && draft.sameAs?.as !== 'version' && !draft.lines.length });
  if (!near || notThese.includes(near.drink.id)) return null;
  const { drink, bar, place } = near;
  const riff = drink.classic && !sameName(drink.classic.name, drink.name) ? `Riff on ${withArticle(drink.classic.name)}` : null;
  return (
    <SameNameCard
      wide={wide}
      words={{
        title: `Is it the ${drink.name}${bar ? ` from ${bar}` : ''}?`,
        line: [place, riff].filter(Boolean).join(' · '),
        open: 'Yes, open it',
        version: 'Make our version',
        different: 'No, a different drink',
      }}
      bar={bar}
      drink={drink}
      caption="Spelled close to yours. A different drink keeps your name as you typed it."
      busy={picks.busy}
      onOpen={() => {
        save.mutate({ itemId: drink.id, typed: draft.name });
        picks.open(drink);
      }}
      onVersion={() => picks.version(drink, bar, drink.spec.length > 0, onStarted)}
      onDifferent={() => setNotThese([...notThese, drink.id])}
    />
  );
}
