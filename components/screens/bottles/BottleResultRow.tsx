import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, useDs } from '@/components/ds';
import { TextLink } from '@/components/screens/menus/MenuPhotoRows';
import { Choice } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { matchKey, type CatalogItem } from '@/lib/match';

import type { BottleRow, BottleTarget } from './useBottlePhoto';

interface BottleResultRowProps {
  row: BottleRow;
  target: BottleTarget;
  onPick: (item: CatalogItem | null, kindId?: string | null) => void;
  onUndo: () => void;
}

/** "London dry gin · 40%" */
function details(row: BottleRow): string {
  return [row.reading.kind, row.reading.abv ? `${row.reading.abv}%` : null].filter(Boolean).join(' · ');
}

/** One bottle read from the photo: added (with Undo), already there, a pick, or not in the catalog. */
export function BottleResultRow({ row, target, onPick, onUndo }: BottleResultRowProps) {
  const ds = useDs();
  const where = target.kind === 'home' ? 'your shelf' : `${target.name}’s ingredients`;
  const locked = target.kind === 'venue' && !target.canEdit;
  const { state, match } = row;
  const as = (item: CatalogItem) => (matchKey(item.name) === matchKey(row.reading.name) ? '' : ` as ${item.name}`);
  const choices = match.kind === 'one' ? [match.item] : match.kind === 'pick' ? match.items : [];

  let body: ReactNode = null;
  if (state.status === 'adding') body = <Caption tone="muted">Adding…</Caption>;
  else if (state.status === 'added') {
    body = (
      <View style={styles.line}>
        <IconSymbol name="checkmark.circle.fill" size={18} color={ds.accentText} />
        <Caption style={styles.flex}>{`Added to ${where}${as(state.item)}`}</Caption>
        <TextLink label="Undo" accessibilityHint={`Takes ${state.item.name} back off ${where}`} onPress={onUndo} />
      </View>
    );
  } else if (state.status === 'already') {
    body = <Caption tone="muted">{`Already in ${where}${as(state.item)}`}</Caption>;
  } else if (locked) {
    body = <Caption tone="muted">Adding to the venue opens at Drink Creator.</Caption>;
  } else if (choices.length) {
    body = (
      <View style={styles.gap}>
        <Caption tone="muted">{match.kind === 'one' ? 'Add it?' : 'Which one is it?'}</Caption>
        <View style={styles.choices}>
          {choices.map((item) => (
            <Choice key={item.id} label={item.name} selected={false} onPress={() => onPick(item)} />
          ))}
        </View>
      </View>
    );
  } else if (match.kind === 'none') {
    const kind = match.kindItem;
    body = (
      <View style={styles.gap}>
        <Caption tone="muted">Not in the catalog yet.</Caption>
        {target.kind === 'venue' ? (
          <Button label="Add as a new ingredient" icon="plus" variant="secondary" accessibilityHint={kind ? `Adds it as a kind of ${kind.name}` : undefined} onPress={() => onPick(null, kind?.id ?? null)} style={styles.start} />
        ) : kind ? (
          <Button label={`Add ${kind.name} instead`} icon="plus" variant="secondary" onPress={() => onPick(kind)} style={styles.start} />
        ) : (
          <Caption tone="muted">Search for it in Add bottles.</Caption>
        )}
      </View>
    );
  }
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <Headline numberOfLines={2}>{row.reading.name}</Headline>
      {details(row) ? <Caption tone="muted">{details(row)}</Caption> : null}
      {state.status === 'failed' ? <Caption tone="accent">{state.message}</Caption> : null}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  gap: { gap: space.sm },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  start: { alignSelf: 'flex-start' },
});
