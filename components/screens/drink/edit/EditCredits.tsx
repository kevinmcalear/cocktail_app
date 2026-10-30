import { View } from 'react-native';

import { Caption } from '@/components/ds';
import { useDrinkCredit, useSetDrinkCredits } from '@/hooks/useLineage';
import { useMyProfile } from '@/hooks/useMyProfile';
import type { WizardDraft } from '@/lib/drinkWizard';
import { creditWrites, savedCredits } from '@/lib/whoMadeIt';

import { useStepSearch } from '../../addDrink/stepSearch';
import { WhoMadeIt } from '../../addDrink/WhoMadeIt';

/**
 * Who made it on a saved drink (Eddie, tf-063: classics above all): the
 * wizard's list, read from the drink's credit. Each change saves as it's
 * made, as the editor's other picks do. People with a page are asked first,
 * as from the wizard; names with no page show as typed.
 */
export function EditCredits({ itemId }: { itemId: string }) {
  const { data: drink } = useDrinkCredit(itemId);
  const myProfileId = useMyProfile().data?.id ?? null;
  const save = useSetDrinkCredits(itemId);
  const search = useStepSearch();
  if (!drink) return null;
  const credits = savedCredits(drink);
  const answered = (drink.co_creators ?? []).flatMap((c) => (c.profile && (c.status ?? 'accepted') === 'accepted' ? [c.profile.id] : []));
  // One change at a time: the next one reads the saved credit the last one left.
  const set = (change: Partial<WizardDraft>) => !save.isPending && save.mutate(creditWrites(drink, { ...credits, ...change }, myProfileId), { onError: () => {} });
  return (
    <View>
      <WhoMadeIt draft={credits} set={set} venueName={null} search={search} answered={answered} headline />
      {save.error ? <Caption tone="accent">{`Couldn't save who made it: ${save.error.message}`}</Caption> : null}
    </View>
  );
}
