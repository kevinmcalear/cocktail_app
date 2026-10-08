import { Caption, ReviewRow } from '@/components/ds';
import { matchKey, type CatalogItem } from '@/lib/match';

import type { BottleChoice, BottleRow, BottleTarget } from './useBottlePhoto';

interface BottleResultRowProps {
  row: BottleRow;
  target: BottleTarget;
  onChoose: (chosen: BottleChoice | null) => void;
  onUndo: () => void;
}

/** "London dry gin · 40%" */
function details(row: BottleRow): string {
  return [row.reading.kind, row.reading.abv ? `${row.reading.abv}%` : null].filter(Boolean).join(' · ');
}

/**
 * One bottle read from a photo: ticked to add, waiting for a pick, skipped,
 * not in the catalog, or (after Add) added with Undo or already there.
 */
export function BottleResultRow({ row, target, onChoose, onUndo }: BottleResultRowProps) {
  const where = target.kind === 'home' ? 'your shelf' : `${target.name}’s ingredients`;
  const locked = target.kind === 'venue' && !target.canEdit;
  const { state, match, chosen } = row;
  const title = row.reading.name;
  const as = (item: CatalogItem) => (matchKey(item.name) === matchKey(title) ? '' : ` as ${item.name}`);
  const say = (status: string) => [status, details(row)].filter(Boolean).join(' · ');
  const failed = state.status === 'failed' ? <Caption tone="accent">{state.message}</Caption> : null;
  const kind = match.kind === 'none' ? match.kindItem : null;
  const skip = { label: 'Skip', hint: `Leaves ${title} out`, onPress: () => onChoose(null) };

  if (state.status === 'adding') return <ReviewRow state="new" title={title} detail={say('Adding…')} />;
  if (state.status === 'added') {
    return <ReviewRow state="have" title={title} detail={say(`Added to ${where}${as(state.item)}`)} action={{ label: 'Undo', hint: `Takes ${state.item.name} back off ${where}`, onPress: onUndo }} />;
  }
  if (state.status === 'already') return <ReviewRow state="have" title={title} detail={say(`Already in ${where}${as(state.item)}`)} />;
  if (locked) return <ReviewRow state="skip" title={title} detail={say('Adding to the venue opens at Drink Creator')} />;

  if (match.kind === 'pick') {
    const picked = chosen?.item ? chosen.item.id : null;
    return (
      <ReviewRow
        state={picked ? 'new' : 'pick'}
        title={title}
        detail={say(picked && chosen?.item ? `Will be added${as(chosen.item)}` : 'Which one is it?')}
        choices={match.items.map((item) => ({ id: item.id, label: item.name }))}
        chosen={picked}
        onChoose={(id) => {
          const item = match.items.find((each) => each.id === id);
          if (item) onChoose({ item });
        }}
        action={picked ? skip : undefined}
      >
        {failed}
      </ReviewRow>
    );
  }
  if (chosen) {
    const label = chosen.item ? `Will be added${as(chosen.item)}` : kind ? `New ingredient, a kind of ${kind.name}` : 'New ingredient';
    return (
      <ReviewRow state="new" title={title} detail={say(label)} action={skip}>
        {failed}
      </ReviewRow>
    );
  }
  if (match.kind === 'one') {
    return <ReviewRow state="skip" title={title} detail={say('Skipped')} action={{ label: 'Add', hint: `Adds ${title} back`, onPress: () => onChoose({ item: match.item }) }} />;
  }
  // Not in the catalog: a venue can make it; a home shelf can take its plain kind.
  const add =
    target.kind === 'venue'
      ? { label: 'Add as new', hint: kind ? `Adds it as a kind of ${kind.name}` : 'Adds it as a new ingredient', onPress: () => onChoose({ item: null, kindId: kind?.id ?? null }) }
      : kind
        ? { label: `Add ${kind.name}`, hint: `Adds plain ${kind.name} instead`, onPress: () => onChoose({ item: kind }) }
        : undefined;
  return (
    <ReviewRow state="skip" title={title} detail={say(add ? 'Not in the catalog yet' : 'Not in the catalog yet. Search for it in Add bottles')} action={add}>
      {failed}
    </ReviewRow>
  );
}
