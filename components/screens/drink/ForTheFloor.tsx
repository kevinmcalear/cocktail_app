import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, DsText, Headline, LockedSection, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useDrinkAllergens } from '@/hooks/useAllergens';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useServiceNotes } from '@/hooks/useServiceNotes';
import { dietaryLine } from '@/lib/dietary';
import { roleLabel } from '@/lib/roles';
import { EMPTY_SERVICE_NOTES, hasTalkingPoints } from '@/lib/serviceNotes';

import { ServiceNotesSheet } from './ServiceNotesSheet';

interface ForTheFloorProps {
  itemId: string;
  barId: string;
  name: string;
  /** Names on the spec as this role sees them, for Dietary. */
  ingredients: (string | null)[];
  canEdit: boolean;
}

/**
 * Talking points for the floor (board drink-phone-floor): Talking point, Sell
 * it as, and Dietary read from the spec (decision b52). Opens at Employee
 * (talking_points), so a server can sell it without the spec. Nothing until
 * there's something to say: Dietary alone still shows.
 */
export function ForTheFloor({ itemId, barId, name, ingredients, canEdit }: ForTheFloorProps) {
  const ds = useDs();
  const { data: caps } = useCapabilities(barId);
  const { data: opensAtLevel } = useCapabilityOpensAt(barId, 'talking_points');
  const unlocked = !!caps?.includes('talking_points');
  const { data: notes = EMPTY_SERVICE_NOTES, isPending } = useServiceNotes(itemId, barId, unlocked);
  const allergens = useDrinkAllergens(unlocked ? itemId : null).data?.allergens.map((a) => a.allergen) ?? [];
  const [editing, setEditing] = useState(false);
  const written = hasTalkingPoints(notes);
  const dietary = dietaryLine(ingredients, allergens);
  if (unlocked && (isPending || (!written && !dietary && !canEdit))) return null;

  const body = (
    <>
      {notes.talkingPoint ? <Point label="Talking point." text={notes.talkingPoint} /> : null}
      {notes.sellItAs ? <Point label="Sell it as." text={notes.sellItAs} /> : null}
      {dietary ? <Point label="Dietary." text={dietary} /> : null}
      {canEdit ? (
        <Button label={written ? 'Edit talking points' : 'Add talking points'} variant="secondary" onPress={() => setEditing(true)} style={styles.edit} />
      ) : null}
      {editing ? <ServiceNotesSheet itemId={itemId} barId={barId} name={name} notes={notes} onClose={() => setEditing(false)} /> : null}
    </>
  );
  if (!unlocked) {
    return (
      <LockedSection title="For the floor" unlocked={false} opensAt={opensAtLevel ? roleLabel(opensAtLevel) : 'Employee'}>
        {null}
      </LockedSection>
    );
  }
  // Open, it's a raised card with run-in labels (board drink-phone-floor).
  return (
    <View role="region" aria-label="For the floor" style={[styles.card, { backgroundColor: ds.c.raised }]}>
      <Headline role="heading">For the floor</Headline>
      {body}
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
  label: { fontFamily: fontFamilies.bodySemiBold },
  edit: { alignSelf: 'flex-start', marginTop: space.xs },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
});
