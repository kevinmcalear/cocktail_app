import { useNearNameDrink } from '@/hooks/useNearNameDrink';
import { useSaveSpelling } from '@/hooks/useSearchNear';
import type { WizardDraft } from '@/lib/drinkWizard';

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
  /** After No: the name field, to tell it apart. */
  onRename?: () => void;
}

/**
 * "Is it the Salti Boi from Pale Moth?" (whole-app canvas, Search page, 3A):
 * the name step's same-name card for a close spelling, at the venue or
 * anywhere. Yes opens that drink and keeps the spelling, so search finds it
 * next time (public.save_spelling); Make our version starts from its spec;
 * No keeps the name as typed. It asks; nothing waits on it.
 */
export function NearNameCard({ draft, set, barId, venueName, hidden, wide, onStarted, onRename }: Props) {
  const picks = useSameNamePicks(set);
  const save = useSaveSpelling();
  const near = useNearNameDrink({ barId, venueName, name: draft.name, enabled: !hidden && !draft.sameAs && !draft.lines.length });
  if (!near) return null;
  const { drink, bar, place } = near;
  return (
    <SameNameCard
      wide={wide}
      near={place}
      bar={bar}
      drink={drink}
      caption="Spelled close to yours. A different drink keeps your name as you typed it."
      busy={picks.busy}
      onOpen={() => {
        save.mutate({ itemId: drink.id, typed: draft.name });
        picks.open(drink);
      }}
      onVersion={() => picks.version(drink, bar, true, onStarted)}
      onDifferent={() => picks.different(drink, bar, onRename)}
    />
  );
}
