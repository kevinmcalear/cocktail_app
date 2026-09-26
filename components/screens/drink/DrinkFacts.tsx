import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Tag, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';

export interface Fact {
  label: string;
  value: string;
}

/** Origin and method, as tags above the name. */
export function DrinkTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <View style={styles.tags}>
      {tags.map((t) => (
        <Tag key={t} label={t} />
      ))}
    </View>
  );
}

/**
 * Glass, ice, family, strength: the facts you check before you reach for a
 * glass. A small grid, not a card per fact.
 */
export function DrinkFacts({ facts, columns }: { facts: Fact[]; columns: number }) {
  const ds = useDs();
  if (!facts.length) return null;
  return (
    <View style={styles.grid} role="list">
      {facts.map((f) => (
        <View
          key={f.label}
          role="listitem"
          accessibilityLabel={`${f.label}: ${f.value}`}
          style={[styles.fact, { backgroundColor: ds.c.raised, width: `${100 / columns - 2}%` }]}
        >
          <Caption tone="muted">{f.label}</Caption>
          <DsText variant="headline" numberOfLines={2}>
            {f.value}
          </DsText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  fact: { borderRadius: radius.control, padding: space.md, gap: 2, flexGrow: 1 },
});
