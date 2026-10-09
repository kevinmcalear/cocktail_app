import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Field, PressableScale, useDs } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useMakerSearch, type MakerRef } from '@/hooks/useMakers';

/**
 * Find a maker's page by name and pick it: for a bottle's maker, or a drink's
 * ice or glass. `makes` narrows it to makers that say they make that.
 */
export function MakerPicker({ label, makes, onPick }: { label: string; makes?: string; onPick: (maker: MakerRef) => void }) {
  const ds = useDs();
  const [term, setTerm] = useState('');
  const { data: makers = [], isFetching } = useMakerSearch(term, makes);
  const searching = term.trim().length >= 2;

  return (
    <View style={styles.stack}>
      <Field label={label} value={term} onChangeText={setTerm} placeholder="Search makers" autoCorrect={false} maxLength={60} />
      {searching && makers.length ? (
        <View role="list">
          {makers.map((m) => (
            <PressableScale
              key={m.id}
              role="button"
              accessibilityLabel={`Pick ${m.display_name}`}
              onPress={() => {
                onPick(m);
                setTerm('');
              }}
              style={[styles.row, { borderTopColor: ds.c.line }]}
            >
              <Body numberOfLines={1}>{m.display_name}</Body>
              <Caption tone="muted">{`@${m.handle}`}</Caption>
            </PressableScale>
          ))}
        </View>
      ) : searching && !isFetching ? (
        <Caption tone="muted">No maker by that name has a page yet.</Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: layout.minTapTarget, borderTopWidth: StyleSheet.hairlineWidth },
});
