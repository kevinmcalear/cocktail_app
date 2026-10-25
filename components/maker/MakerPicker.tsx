import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Field, PressableScale, useDs } from '@/components/ds';
import { NearPicks, splitNear } from '@/components/search/NearPicks';
import { layout, space } from '@/constants/tokens';
import { useMakerSearch, type MakerRef } from '@/hooks/useMakers';

/**
 * Find a maker's page by name and pick it: for a bottle's maker, or a drink's
 * ice or glass. `makes` narrows it to makers that say they make that.
 */
export function MakerPicker({ label, makes, onPick }: { label: string; makes?: string; onPick: (maker: MakerRef) => void }) {
  const ds = useDs();
  const [term, setTerm] = useState('');
  const { data = [], isFetching } = useMakerSearch(term, makes);
  const [makers, near] = splitNear(data);
  const searching = term.trim().length >= 2;
  const row = (m: MakerRef) => (
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
  );

  return (
    <View style={styles.stack}>
      <Field label={label} value={term} onChangeText={setTerm} placeholder="Search makers" autoCorrect={false} maxLength={60} />
      {searching && data.length ? (
        <View role="list">
          {makers.map(row)}
          <NearPicks found={makers.length > 0} near={near} render={row} />
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
