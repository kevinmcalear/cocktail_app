import { StyleSheet, View } from 'react-native';

import { Body, DsText, Headline, LockedSection, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useDrinkAllergens } from '@/hooks/useAllergens';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useServiceNotes } from '@/hooks/useServiceNotes';
import { dietaryLine } from '@/lib/dietary';
import { roleLabel } from '@/lib/roles';
import { EMPTY_SERVICE_NOTES, hasTalkingPoints } from '@/lib/serviceNotes';

interface ForTheFloorProps {
  itemId: string;
  barId: string;
  /** Names on the spec as this role sees them, for Dietary. */
  ingredients: (string | null)[];
}

/**
 * Talking points for the floor (board drink-phone-floor): Talking point and
 * Sell it as in "For the floor", and Dietary in its own "Dietary notes" card,
 * read from the spec (decision b52; Kevin split them 26 Oct). Opens at
 * Employee (talking_points), so a server can sell it without the spec. Each
 * card shows only when there's something in it. Read only: the drink's
 * editors write the talking points in the editor (board drink-read-and-edit).
 */
export function ForTheFloor({ itemId, barId, ingredients }: ForTheFloorProps) {
  const ds = useDs();
  const { data: caps } = useCapabilities(barId);
  const { data: opensAtLevel } = useCapabilityOpensAt(barId, 'talking_points');
  const unlocked = !!caps?.includes('talking_points');
  const { data: notes = EMPTY_SERVICE_NOTES, isPending } = useServiceNotes(itemId, barId, unlocked);
  const allergens = useDrinkAllergens(unlocked ? itemId : null).data?.allergens.map((a) => a.allergen) ?? [];
  const written = hasTalkingPoints(notes);
  const dietary = dietaryLine(ingredients, allergens);
  if (unlocked && (isPending || (!written && !dietary))) return null;

  if (!unlocked) {
    return (
      <LockedSection title="For the floor" unlocked={false} opensAt={opensAtLevel ? roleLabel(opensAtLevel) : 'Employee'}>
        {null}
      </LockedSection>
    );
  }
  // Open, each is a raised card with run-in labels (board drink-phone-floor).
  return (
    <>
      {written ? (
        <View role="region" aria-label="For the floor" style={[styles.card, { backgroundColor: ds.c.raised }]}>
          <Headline role="heading">For the floor</Headline>
          {notes.talkingPoint ? <Point label="Talking point." text={notes.talkingPoint} /> : null}
          {notes.sellItAs ? <Point label="Sell it as." text={notes.sellItAs} /> : null}
        </View>
      ) : null}
      {dietary ? (
        <View role="region" aria-label="Dietary notes" style={[styles.card, { backgroundColor: ds.c.raised }]}>
          <Headline role="heading">Dietary notes</Headline>
          <Body>{dietary}</Body>
        </View>
      ) : null}
    </>
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
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
});
