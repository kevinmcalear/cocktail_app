import { StyleSheet, View } from 'react-native';

import { Body, DsText, Headline, LockedSection, useDs } from '@/components/ds';
import { font, radius, space } from '@/constants/tokens';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useServiceNotes } from '@/hooks/useServiceNotes';
import { roleLabel } from '@/lib/roles';
import { EMPTY_SERVICE_NOTES, hasTalkingPoints } from '@/lib/serviceNotes';

interface ForTheFloorProps {
  itemId: string;
  barId: string;
}

/**
 * Talking points for the floor (board Decided-who-floor): Talking point and
 * Sell it as in "For the floor". Vegan reads on the floor's allergy line
 * (AllergyLine, lib/dietary veganWord), its one home. Opens at
 * Employee (talking_points), so a server can sell it without the spec. Each
 * card shows only when there's something in it. Read only: the drink's
 * editors write the talking points in the editor (board drink-read-and-edit).
 */
export function ForTheFloor({ itemId, barId }: ForTheFloorProps) {
  const ds = useDs();
  const { data: caps } = useCapabilities(barId);
  const { data: opensAtLevel } = useCapabilityOpensAt(barId, 'talking_points');
  const unlocked = !!caps?.includes('talking_points');
  const { data: notes = EMPTY_SERVICE_NOTES, isPending } = useServiceNotes(itemId, barId, unlocked);
  const written = hasTalkingPoints(notes);
  if (unlocked && (isPending || !written)) return null;

  if (!unlocked) {
    return (
      <LockedSection title="For the floor" unlocked={false} opensAt={opensAtLevel ? roleLabel(opensAtLevel) : 'Employee'}>
        {null}
      </LockedSection>
    );
  }
  // Open, a raised card with run-in labels.
  return (
    <View role="region" aria-label="For the floor" style={[styles.card, { backgroundColor: ds.c.raised }]}>
      <Headline role="heading">For the floor</Headline>
      {notes.talkingPoint ? <Point label="Talking point." text={notes.talkingPoint} /> : null}
      {notes.sellItAs ? <Point label="Sell it as." text={notes.sellItAs} /> : null}
    </View>
  );
}

function Point({ label, text }: { label: string; text: string }) {
  return (
    <View>
      <Body>
        <DsText style={styles.label}>{label}</DsText> {text}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...font.semiBold },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
});
