import { StyleSheet, View } from 'react-native';

import { DsText, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { useDrinkAllergens } from '@/hooks/useAllergens';
import { useGuestDrinkAllergens, useMyAllergies } from '@/hooks/useGuestAllergies';
import { withAlpha } from '@/lib/color';
import { allergenLabel, allergyMatches, containsLine } from '@/lib/allergens';

import { useItemTones } from './MaterialBar';

/**
 * One line, first on the page (boards Decided-who-floor, -guest-hit).
 * The floor always sees the drink's allergens, "No allergens" too: they need
 * certainty, not silence. A guest sees a line only when they have told us
 * their allergies, and only a warning (#1045: warn-only, on a drink the bar
 * has checked; unchecked says ask your bartender). Their list never leaves
 * the phone: matching happens here.
 */
export function AllergyLine({ itemId, guest, atBar = true }: { itemId: string; guest: boolean; atBar?: boolean }) {
  return guest ? <GuestLine itemId={itemId} atBar={atBar} /> : <FloorLine itemId={itemId} />;
}

function FloorLine({ itemId }: { itemId: string }) {
  const { data } = useDrinkAllergens(itemId);
  // Nothing to declare yet (a beer, or a drink with no spec): no line, rather than a line about nothing.
  if (!data || (data.lines === 0 && !data.allergens.length)) return null;
  return <Line text={containsLine(data)} />;
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

function Line({ text, aside, hit }: { text: string; aside?: string; hit?: boolean }) {
  const ds = useDs();
  // Android's tonal card (And-who-floor, -guest-hit): the page's tone, or the error colours on a match.
  const tones = useItemTones();
  const ink = hit ? (tones?.warn.ink ?? (ds.scheme === 'dark' ? STATUS.warning : ds.c.ink)) : ds.c.ink;
  const fill = tones ? (hit ? tones.warn.fill : tones.card) : hit ? withAlpha(STATUS.danger, ds.scheme === 'dark' ? 0.22 : 0.12) : ds.c.raised;
  return (
    <View role="note" style={[styles.line, tones ? styles.card : null, { backgroundColor: fill }]}>
      <IconSymbol name="exclamationmark.triangle" size={tones ? 20 : 18} color={ink} />
      <DsText variant="label" color={ink} style={styles.text}>
        {text}
      </DsText>
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
  card: { gap: space.md, paddingHorizontal: space.lg, borderRadius: space.lg },
  text: { flex: 1, fontWeight: '600' },
});
