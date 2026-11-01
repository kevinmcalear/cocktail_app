import { StyleSheet, View } from 'react-native';

import { DsText, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { useDrinkAllergens } from '@/hooks/useAllergens';
import { useGuestDrinkAllergens, useMyAllergies } from '@/hooks/useGuestAllergies';
import { withAlpha } from '@/lib/color';
import { allergyMatches, allergyWarning, containsLine } from '@/lib/allergens';

/**
 * One line, first on the page (boards Decided-who-floor, -guest-hit,
 * Loop-allergy "A match"). The floor always sees the drink's allergens:
 * they need certainty, not silence, and never "No allergens" before the bar
 * has checked it. Anyone else sees a line only when the drink has one of
 * their allergies and the bar has checked it: a warning, never a tick
 * (#1045). The full list, and Ask your bartender on an unchecked drink, is
 * the Allergens section under the spec. Their list never leaves the phone:
 * matching happens here.
 */
export function AllergyLine({ itemId, guest }: { itemId: string; guest: boolean }) {
  return guest ? <GuestLine itemId={itemId} /> : <FloorLine itemId={itemId} />;
}

function FloorLine({ itemId }: { itemId: string }) {
  const { data } = useDrinkAllergens(itemId);
  // Nothing to declare yet (a beer, or a drink with no spec): no line, rather than a line about nothing.
  if (!data || (data.lines === 0 && !data.allergens.length)) return null;
  return <AllergyBox title={containsLine(data)} />;
}

function GuestLine({ itemId }: { itemId: string }) {
  const { data: mine } = useMyAllergies();
  const { data: drinks } = useGuestDrinkAllergens(mine?.length ? [itemId] : []);
  const drink = drinks?.get(itemId);
  const warning = mine?.length && drink ? allergyWarning(allergyMatches(mine, drink)) : null;
  return warning ? <AllergyBox title={warning.title} body={warning.body} aside="Your allergies" hit /> : null;
}

/** The tinted line with the warning triangle: the floor's allergens, or a guest's match (hit). */
export function AllergyBox({ title, body, aside, hit }: { title: string; body?: string; aside?: string; hit?: boolean }) {
  const ds = useDs();
  const ink = hit && ds.scheme === 'dark' ? STATUS.warning : ds.c.ink;
  return (
    <View role={hit ? 'alert' : 'note'} style={[styles.line, { backgroundColor: hit ? withAlpha(STATUS.danger, ds.scheme === 'dark' ? 0.22 : 0.12) : ds.c.raised }]}>
      <IconSymbol name="exclamationmark.triangle" size={18} color={ink} />
      <View style={styles.text}>
        <DsText variant="label" color={ink} style={styles.title}>
          {title}
        </DsText>
        {body ? (
          <DsText variant="label" color={ink}>
            {body}
          </DsText>
        ) : null}
      </View>
      {aside ? (
        <DsText variant="caption" tone="muted">
          {aside}
        </DsText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingVertical: space.md, paddingHorizontal: space.md + 2, borderRadius: radius.control + 2, borderCurve: 'continuous' },
  text: { flex: 1, gap: 2 },
  title: { fontWeight: '600' },
});
