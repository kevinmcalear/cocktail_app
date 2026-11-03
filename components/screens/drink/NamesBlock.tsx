import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PalateFlower } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useFlavorBaseline, useItemFlavor, useMyTaste } from '@/hooks/useFlavor';
import { meet, meetingWords } from '@/lib/palate';

import { AllergyLine } from './AllergyLine';

interface NamesBlockProps {
  itemId: string;
  name: string;
  guest: boolean;
  /** What it tastes like: the drink's description. */
  tastes: string | null;
  /** Names on the spec as this role sees them: vegan on the floor's allergy line. */
  ingredients: readonly (string | null)[];
}

/**
 * What a guest or the floor reads above what's in it (boards Decided-who-guest,
 * -floor): the allergy line, what it tastes like, and for a guest how it meets
 * their palate. Nothing here says what's held back.
 */
export function NamesBlock({ itemId, name, guest, tastes, ingredients }: NamesBlockProps) {
  return (
    <View style={styles.block}>
      <AllergyLine itemId={itemId} guest={guest} ingredients={ingredients} />
      {tastes ? <Body>{tastes}</Body> : null}
      {guest ? <PalateFit itemId={itemId} name={name} /> : null}
    </View>
  );
}

/** Their taste as petals, the drink as a line, in lib/palate's words. Only with a taste to compare. */
export function PalateFit({ itemId, name }: { itemId: string; name: string }) {
  const { data: flavor } = useItemFlavor(itemId);
  const { data: me } = useMyTaste();
  const { data: baseline } = useFlavorBaseline();
  if (!flavor || !me || !Object.keys(me.taste).length) return null;
  const words = meetingWords(meet(me.taste, flavor.profile, baseline ?? null));
  if (!words.like && !words.diff) return null;
  return (
    <View style={styles.fit} accessible accessibilityLabel={`Your palate and ${name}: ${[words.like, words.diff].filter(Boolean).join('. ')}`}>
      <PalateFlower values={me.taste} compare={flavor.profile} size={104} rings={false} />
      <View style={styles.words}>
        {words.like ? (
          <DsText variant="body" style={styles.like}>
            {words.like}
          </DsText>
        ) : null}
        {words.diff ? <DsText variant="label" tone="muted">{words.diff}</DsText> : null}
        <Caption tone="muted">Petals: your taste · line: this drink</Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.lg },
  fit: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  words: { flex: 1, gap: space.xs },
  like: { fontWeight: '600' },
});
