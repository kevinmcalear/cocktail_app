import { ReviewRow } from '@/components/ds';
import type { PasteRow } from '@/lib/paste';

interface PhotoRowProps {
  row: PasteRow;
  onPick: (drinkId: string) => void;
  /** A drink that isn't in the library yet: finish it in Bring in. Left out, the sheet's own button does that. */
  onFinish?: (name: string, ingredients: string[]) => void;
}

/** One drink read from a photo or a pasted list, as a review row. */
export function PhotoRow({ row, onPick, onFinish }: PhotoRowProps) {
  if (row.status === 'pick') {
    return (
      <ReviewRow
        state="pick"
        title={row.name}
        detail="Which one?"
        choices={row.options.map((option) => ({ id: option.id, label: option.name, detail: option.line || option.kind }))}
        onChoose={onPick}
      />
    );
  }
  if (row.status === 'add') {
    return <ReviewRow state="have" title={row.drink.name} detail={['Matched in your library', row.note].filter(Boolean).join(' · ')} />;
  }
  if (row.status === 'missing') {
    return (
      <ReviewRow
        state="new"
        title={row.name}
        detail={['New', row.ingredients.join(', ')].filter(Boolean).join(' · ')}
        action={onFinish ? { label: 'Finish', hint: `Adds ${row.name} to the library`, onPress: () => onFinish(row.name, row.ingredients) } : undefined}
      />
    );
  }
  return <ReviewRow state="skip" title={row.name} detail={row.note} />;
}
