import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { methodIceLabel, type StepProps, type WizardPick } from '@/lib/drinkWizard';
import { isVenueIce } from '@/lib/venueKit';

import { PickStep } from './PickStep';
import { Eyebrow } from './WizardChrome';

interface IceStepProps extends StepProps {
  ices: WizardPick[];
  /** The venue's ice, listed first under "Your ice". */
  barIce: string[];
  suggested?: string | null;
  why?: string | null;
  /** The desktop page's one-row pickers. */
  compact?: boolean;
}

/**
 * Two ices (Ian at Bar Snack, 16 Oct; board create-eddie-oct16): the one it's
 * made with, named for the method ("Blended with"), and the one it's served
 * over. A built drink has only the second.
 */
export function IceStep({ draft, set, ices, barIce, suggested, why, compact }: IceStepProps) {
  const made = methodIceLabel(draft.methods.map((m) => m.name));
  const mine = barIce.length ? { has: (p: WizardPick) => isVenueIce(barIce, p.name), label: 'Your ice', restLabel: 'Other ice' } : undefined;
  return (
    <View style={styles.stack}>
      {made ? (
        <View style={styles.group}>
          <Eyebrow>{made}</Eyebrow>
          <PickStep label={made} ownLabel="Other ice" compact={compact} options={ices} selected={draft.methodIce ? [draft.methodIce] : []} onChange={([ice]) => set({ methodIce: ice ?? null })} />
          <Caption tone="muted">Follows the method: shaken with, stirred over, blended with.</Caption>
        </View>
      ) : null}
      <View style={styles.group}>
        <Eyebrow>Served over</Eyebrow>
        <PickStep label="Served over" ownLabel="Other ice" compact={compact} options={ices} selected={draft.ice ? [draft.ice] : []} onChange={([ice]) => set({ ice: ice ?? null })} suggested={suggested} why={why} mine={mine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xl },
  group: { gap: space.sm },
});
