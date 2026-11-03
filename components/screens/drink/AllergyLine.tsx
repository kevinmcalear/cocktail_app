import { StyleSheet, View } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space, STATUS } from '@/constants/tokens';
import { useDrinkAllergens } from '@/hooks/useAllergens';
import { useGuestDrinkAllergens, useMyAllergies } from '@/hooks/useGuestAllergies';
import { withAlpha } from '@/lib/color';
import { allergyMatches } from '@/lib/allergens';
import { allergyWarning, containsLine } from '@/lib/allergenWords';
import { veganWord, withVegan } from '@/lib/dietary';

import { useItemTones } from './MaterialBar';

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
export function AllergyLine({ itemId, guest, ingredients, onPress }: { itemId: string; guest: boolean; ingredients?: readonly (string | null)[]; onPress?: () => void }) {
  return guest ? <GuestLine itemId={itemId} /> : <FloorLine itemId={itemId} ingredients={ingredients} onPress={onPress} />;
}

/** The floor's line. With the recipe's names, vegan rides on it (boards Decided-who-floor, Item-page house-made staff: "No allergens · not vegan (honey)"); `onPress` opens the full list. */
function FloorLine({ itemId, ingredients, onPress }: { itemId: string; ingredients?: readonly (string | null)[]; onPress?: () => void }) {
  const { data } = useDrinkAllergens(itemId);
  // Nothing to declare yet (a beer, or a drink with no spec): no line, rather than a line about nothing.
  if (!data || (data.lines === 0 && !data.allergens.length)) return null;
  const vegan = ingredients
    ? veganWord(
        ingredients,
        data.allergens.map((a) => a.allergen),
        data.unchecked === 0,
      )
    : null;
  return <AllergyBox title={withVegan(containsLine(data), vegan)} onPress={onPress} />;
}

function GuestLine({ itemId }: { itemId: string }) {
  const { data: mine } = useMyAllergies();
  const { data: drinks } = useGuestDrinkAllergens(mine?.length ? [itemId] : []);
  const drink = drinks?.get(itemId);
  const warning = mine?.length && drink ? allergyWarning(allergyMatches(mine, drink)) : null;
  return warning ? <AllergyBox title={warning.title} body={warning.body} aside="Your allergies" hit /> : null;
}

/** The tinted line with the warning triangle: the floor's allergens, or a guest's match (hit). */
export function AllergyBox({ title, body, aside, hit, onPress }: { title: string; body?: string; aside?: string; hit?: boolean; onPress?: () => void }) {
  const ds = useDs();
  // Android's tonal card (And-who-floor, -guest-hit): the page's tone, or the error colours on a match.
  const tones = useItemTones();
  const ink = hit ? (tones?.warn.ink ?? (ds.scheme === 'dark' ? STATUS.warning : ds.c.ink)) : ds.c.ink;
  const fill = tones ? (hit ? tones.warn.fill : tones.card) : hit ? withAlpha(STATUS.danger, ds.scheme === 'dark' ? 0.22 : 0.12) : ds.c.raised;
  const Box = onPress ? PressableScale : View;
  return (
    <Box role={hit ? 'alert' : onPress ? 'button' : 'note'} accessibilityHint={onPress ? 'Opens the allergens' : undefined} onPress={onPress} style={[styles.line, tones ? styles.card : null, { backgroundColor: fill }]}>
      <IconSymbol name="exclamationmark.triangle" size={tones ? 20 : 18} color={ink} />
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
      {onPress && !tones ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
    </Box>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingVertical: space.md, paddingHorizontal: space.md + 2, borderRadius: radius.control + 2, borderCurve: 'continuous' },
  card: { gap: space.md, paddingHorizontal: space.lg, borderRadius: space.lg },
  text: { flex: 1, gap: 2 },
  title: { ...font.semiBold },
});
