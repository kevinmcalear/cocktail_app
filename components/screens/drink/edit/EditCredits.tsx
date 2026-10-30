import { View } from 'react-native';

import { Caption } from '@/components/ds';
import { useDrinkCredit, useSetDrinkCredits } from '@/hooks/useLineage';
import type { CreditPick } from '@/lib/drinkWizard';
import { editorAdd, editorRemove, savedCredit, savedCredits, type CreditEdit } from '@/lib/whoMadeIt';

import { useStepSearch } from '../../addDrink/stepSearch';
import { WhoMadeIt } from '../../addDrink/WhoMadeIt';

/**
 * Who made it on a saved drink (Eddie, tf-063: classics above all): the
 * wizard's list, read from the drink's credit. Each change saves as it's
 * made, as the editor's other picks do, in one call. Adding someone never
 * takes the creator's place (lib/whoMadeIt editorAdd); people with a page
 * are asked first, as from the wizard; names with no page show as typed.
 */
export function EditCredits({ itemId }: { itemId: string }) {
  const { data: drink } = useDrinkCredit(itemId);
  const save = useSetDrinkCredits(itemId);
  const search = useStepSearch();
  if (!drink) return null;
  const saved = savedCredit(drink);
  const answered = saved.rows.filter((r) => r.status === 'accepted').map((r) => r.id);
  const declined = saved.rows.filter((r) => r.status === 'declined').map((r) => r.id);
  const apply = (edit: CreditEdit | null) => edit && save.mutate(edit, { onError: () => {} });
  return (
    <View>
      <WhoMadeIt
        draft={savedCredits(drink)}
        venueName={null}
        search={search}
        answered={answered}
        exclude={declined}
        // One change at a time: the next one starts from what the last one saved.
        disabled={save.isPending}
        onAdd={(p: CreditPick) => apply(editorAdd(saved, p))}
        onRemove={(p: CreditPick) => apply(editorRemove(saved, p))}
        headline
      />
      {save.error ? <Caption tone="accent">{`Couldn't save who made it: ${save.error.message}`}</Caption> : null}
    </View>
  );
}
