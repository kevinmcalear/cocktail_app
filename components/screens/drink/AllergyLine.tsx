import { StyleSheet, View } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { useDrinkAllergens, useItemAllergens } from '@/hooks/useAllergens';
import { useGuestDrinkAllergens, useMyAllergies } from '@/hooks/useGuestAllergies';
import { withAlpha } from '@/lib/color';
import { allergenLabel, allergyMatches, containsLine, ownAllergenLine } from '@/lib/allergens';
import { veganWord, withVegan } from '@/lib/dietary';

import { useItemTones } from './MaterialBar';

/**
 * One line, first on the page (boards Decided-who-floor, -guest-hit).
 * The floor always sees the drink's allergens, "No allergens" too: they need
 * certainty, not silence. A guest sees a line only when they have told us
 * their allergies, and only a warning (#1045: warn-only, on a drink the bar
 * has checked; unchecked says ask your bartender). Their list never leaves
 * the phone: matching happens here.
 */
export function AllergyLine({ itemId, guest, atBar = true, ingredients, own, onPress }: { itemId: string; guest: boolean; atBar?: boolean; ingredients?: readonly (string | null)[]; own?: string | null; onPress?: () => void }) {
  return guest ? <GuestLine itemId={itemId} atBar={atBar} /> : <FloorLine itemId={itemId} ingredients={ingredients} own={own} onPress={onPress} />;
}

/** With the recipe's names, vegan rides on it (board Item-page, house-made staff: "No allergens · not vegan (honey)"); `onPress` opens the full list. */
function FloorLine({ itemId, ingredients, own, onPress }: { itemId: string; ingredients?: readonly (string | null)[]; own?: string | null; onPress?: () => void }) {
  const { data } = useDrinkAllergens(itemId);
  // A beer or wine has no spec: its own declaration, the bar's once it has checked it, else the catalogue's
  // (Item-page staff: "Sulphites"). `own` is the item's bar, set where the item is poured as it is.
  const mine = own !== undefined && data?.lines === 0;
  const { data: declared, isPending } = useItemAllergens(mine ? itemId : null, own ?? null);
  if (mine) return isPending ? null : <Line text={ownAllergenLine(declared?.bar ?? declared?.catalogue ?? null)} onPress={onPress} />;
  // Nothing to declare yet (a drink with no spec): no line, rather than a line about nothing.
  if (!data || (data.lines === 0 && !data.allergens.length)) return null;
  const vegan = ingredients
    ? veganWord(
        ingredients,
        data.allergens.map((a) => a.allergen),
        data.unchecked === 0,
      )
    : null;
  return <Line text={withVegan(containsLine(data), vegan)} onPress={onPress} />;
}

function GuestLine({ itemId, atBar }: { itemId: string; atBar: boolean }) {
  const { data: mine = [] } = useMyAllergies();
  const { data: drinks } = useGuestDrinkAllergens(mine.length ? [itemId] : []);
  const drink = drinks?.get(itemId);
  if (!mine.length || !drink) return null;
  const hits = allergyMatches(mine, drink);
  // Unchecked: only a bar has a bartender to ask.
  if (hits === null) return atBar ? <Line text="Ask your bartender about your allergies" aside="Your allergies" /> : null;
  if (!hits.length) return null;
  const text = `Contains ${hits.map((h) => `${allergenLabel(h.allergen).toLowerCase()}${h.ingredient ? `, from the ${h.ingredient.toLowerCase()}` : ''}`).join('; ')}`;
  return <Line text={text} aside="Your allergies" hit />;
}

function Line({ text, aside, hit, onPress }: { text: string; aside?: string; hit?: boolean; onPress?: () => void }) {
  const ds = useDs();
  // Android's tonal card (And-who-floor, -guest-hit): the page's tone, or the error colours on a match.
  const tones = useItemTones();
  const ink = hit ? (tones?.warn.ink ?? (ds.scheme === 'dark' ? STATUS.warning : ds.c.ink)) : ds.c.ink;
  const fill = tones ? (hit ? tones.warn.fill : tones.card) : hit ? withAlpha(STATUS.danger, ds.scheme === 'dark' ? 0.22 : 0.12) : ds.c.raised;
  const Box = onPress ? PressableScale : View;
  return (
    <Box role={onPress ? 'button' : 'note'} accessibilityHint={onPress ? 'Opens the allergens' : undefined} onPress={onPress} style={[styles.line, tones ? styles.card : null, { backgroundColor: fill }]}>
      <IconSymbol name="exclamationmark.triangle" size={tones ? 20 : 18} color={ink} />
      <DsText variant="label" color={ink} style={styles.text}>
        {text}
      </DsText>
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
  text: { flex: 1, fontWeight: '600' },
});
