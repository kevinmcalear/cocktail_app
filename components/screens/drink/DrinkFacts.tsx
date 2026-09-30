import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, Tag, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';

export interface Fact {
  label: string;
  value: string;
  /** A small line under the value: "calculated", "after 25% water". */
  sub?: string;
  /** Tapping opens more (the strength sheet). */
  onPress?: () => void;
  accessibilityHint?: string;
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
      {facts.map((f) => {
        const Cell = f.onPress ? PressableScale : View;
        return (
          <Cell
            key={f.label}
            role={f.onPress ? 'button' : 'listitem'}
            accessibilityLabel={`${f.label}: ${f.value}${f.sub ? `, ${f.sub}` : ''}`}
            accessibilityHint={f.accessibilityHint}
            onPress={f.onPress}
            style={[styles.fact, { backgroundColor: ds.c.raised, width: `${100 / columns - 2}%` }]}
          >
            <Caption tone="muted">{f.label}</Caption>
            <DsText variant="headline" numberOfLines={2}>
              {f.value}
            </DsText>
            {f.sub ? <Caption tone="muted">{f.sub}</Caption> : null}
          </Cell>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  fact: { borderRadius: radius.control, padding: space.md, gap: 2, flexGrow: 1 },
});
