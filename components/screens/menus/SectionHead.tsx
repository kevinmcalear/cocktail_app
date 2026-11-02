import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { font } from '@/constants/tokens';

/** A section's name, small in capitals, with how many drinks it has on the page. Centred, with no count, on the card. */
export function SectionHead({ name, count }: { name: string; count: number | null }) {
  const page = count !== null;
  return (
    <View style={[styles.head, !page && styles.centred]}>
      <Caption tone="muted" role="heading" style={[styles.title, page && styles.figures]}>
        {name.toUpperCase()}
      </Caption>
      {page ? (
        <Caption tone="muted" style={styles.figures}>
          {count}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  centred: { justifyContent: 'center' },
  title: { letterSpacing: 1.5 },
  figures: { ...font.figures },
});
