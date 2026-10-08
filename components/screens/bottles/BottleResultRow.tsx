import { StyleSheet } from 'react-native';

import { Button, Caption, ReviewRow } from '@/components/ds';
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
  const where = target.kind === 'home' ? 'your shelf' : `${target.name}’s ingredients`;
  const locked = target.kind === 'venue' && !target.canEdit;
  const { state, match } = row;
  const title = row.reading.name;
  const as = (item: CatalogItem) => (matchKey(item.name) === matchKey(title) ? '' : ` as ${item.name}`);
  const say = (status: string) => [status, details(row)].filter(Boolean).join(' · ');
  const choices = match.kind === 'one' ? [match.item] : match.kind === 'pick' ? match.items : [];
  const failed = state.status === 'failed' ? <Caption tone="accent">{state.message}</Caption> : null;

  if (state.status === 'adding') return <ReviewRow state="new" title={title} detail={say('Adding…')} />;
  if (state.status === 'added') {
    return <ReviewRow state="have" title={title} detail={say(`Added to ${where}${as(state.item)}`)} action={{ label: 'Undo', hint: `Takes ${state.item.name} back off ${where}`, onPress: onUndo }} />;
  }
  if (state.status === 'already') return <ReviewRow state="have" title={title} detail={say(`Already in ${where}${as(state.item)}`)} />;
  if (locked) return <ReviewRow state="skip" title={title} detail={say('Adding to the venue opens at Drink Creator')} />;
  if (choices.length) {
    return (
      <ReviewRow
        state="pick"
        title={title}
        detail={say(match.kind === 'one' ? 'Add it?' : 'Which one is it?')}
        choices={choices.map((item) => ({ id: item.id, label: item.name }))}
        onChoose={(id) => onPick(choices.find((item) => item.id === id) ?? null)}
      >
        {failed}
      </ReviewRow>
    );
  }
  const kind = match.kind === 'none' ? match.kindItem : null;
  return (
    <ReviewRow state="new" title={title} detail={say('Not in the catalog yet')}>
      {failed}
      {target.kind === 'venue' ? (
        <Button label="Add as a new ingredient" icon="plus" variant="secondary" accessibilityHint={kind ? `Adds it as a kind of ${kind.name}` : undefined} onPress={() => onPick(null, kind?.id ?? null)} style={styles.start} />
      ) : kind ? (
        <Button label={`Add ${kind.name} instead`} icon="plus" variant="secondary" onPress={() => onPick(kind)} style={styles.start} />
      ) : (
        <Caption tone="muted">Search for it in Add bottles.</Caption>
      )}
    </ReviewRow>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
});
