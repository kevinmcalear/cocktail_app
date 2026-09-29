import { StyleSheet, View } from 'react-native';

import { Body } from '@/components/ds';
import { DrinkFacts } from '@/components/screens/drink/DrinkFacts';
import { space } from '@/constants/tokens';
import type { StudyCardData } from '@/hooks/useStudyDecks';

/**
 * The back of a beer or wine card: no spec to learn, so the facts staff give
 * at the table (style, maker, region, strength, serve) and how it tastes.
 */
export function PourBack({ card }: { card: StudyCardData }) {
  return (
    <View style={styles.wrap}>
      <DrinkFacts facts={card.facts} columns={2} />
      {card.about ? <Body>{card.about}</Body> : null}
      {!card.facts.length && !card.about ? <Body tone="muted">Nothing written down about this one yet.</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
});
