import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { partSentence } from '@/lib/drinkParts';
import type { DatabaseItem } from '@/types/types';

/**
 * A drink made in parts (canvas Q20b, frame 4): the parts in order, each
 * with its name, how it's made, its lines and how it joins. "1 The coffee.
 * Build in the glass: Irish whiskey, Hot coffee." Nothing for a drink in one part.
 */
export function DrinkParts({ item }: { item: DatabaseItem }) {
  const parts = item.madeInParts;
  if (!parts?.length) return null;
  const methods = [...(item.item_methods ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return (
    <PartsList
      parts={parts.map((p, i) => {
        const lines = (item.recipes ?? []).filter((r) => r.part === i + 1).flatMap((r) => (r.ingredient?.name ? [r.ingredient.name] : []));
        const how = methods.filter((m) => m.part === i + 1).flatMap((m) => (m.method?.name ? [m.method.name] : []));
        return { name: p.name, text: partSentence(how, lines, i > 0 ? p.join : null) };
      })}
    />
  );
}

/** The parts as numbered rows, each its name and its sentence: the drink page's look, the public page's too. */
export function PartsList({ parts }: { parts: { name: string; text: string }[] }) {
  const ds = useDs();
  return (
    <View style={styles.stack}>
      <Caption tone="muted" style={styles.label}>
        Method
      </Caption>
      <View role="list" aria-label="Made in parts" style={styles.stack}>
        {parts.map((p, i) => (
          <View key={i} role="listitem" style={styles.row}>
            <View style={[styles.number, { backgroundColor: ds.accentFill.fill }]}>
              <DsText variant="caption" color={ds.accentFill.text}>
                {String(i + 1)}
              </DsText>
            </View>
            <Body style={styles.flex}>
              <Body style={styles.name}>{`${p.name}. `}</Body>
              {p.text}
            </Body>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  label: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  number: { width: 24, height: 24, marginTop: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fontFamilies.bodyMedium },
  flex: { flex: 1 },
});
