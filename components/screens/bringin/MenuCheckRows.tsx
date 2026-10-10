import { StyleSheet, View } from 'react-native';

import { Body, Caption, ReviewMark, ReviewRow, Spec, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { ingredientState, type MatchData, type MenuRow } from '@/lib/bringInMatch';
import type { ReadFile } from '@/lib/readAnything';
import type { SkippedLine } from '@/supabase/functions/_shared/anythingRead';
import { useBringIn } from '@/store/useBringIn';

import { SourceCrop } from './PagePicture';

const fileAt = (files: ReadFile[], at: { page: number } | null) => (at ? (files[at.page] ?? null) : null);
const words = (name: string, ingredients: string[]) => [name, ingredients.slice(0, 2).join(', ').toLowerCase()].filter(Boolean).join(' ');

function Price({ value }: { value: string | null }) {
  return value ? <Spec tone="muted">{value}</Spec> : null;
}

/** The ingredients printed under a new drink, each matched: in your bar, a new prep, new. */
function NewDrinkPanel({ ingredients, data }: { ingredients: string[]; data: MatchData }) {
  const ds = useDs();
  const openSheet = useBringIn((s) => s.openSheet);
  return (
    <View style={[styles.panel, { backgroundColor: ds.c.surface }]}>
      {ingredients.map((name) => {
        const s = ingredientState(name, data);
        const label = s.state === 'have' ? 'In your bar' : s.state === 'pick' ? 'Which one? Saves as the kind' : s.prep ? 'New prep' : 'New';
        return (
          <View key={name} style={styles.ingredient}>
            <ReviewMark state={s.state === 'new' ? 'new' : s.state === 'pick' ? 'pick' : 'have'} size={16} />
            <Body style={styles.flex}>{name}</Body>
            <Caption tone={s.state === 'new' ? 'accent' : 'muted'}>{label}</Caption>
          </View>
        );
      })}
      <Caption tone="muted">
        No amounts on a menu. Add them later, or{' '}
        <Caption tone="accent" onPress={openSheet} role="link">
          add a spec photo
        </Caption>
        .
      </Caption>
    </View>
  );
}

interface MenuLineProps {
  row: MenuRow;
  files: ReadFile[];
  data: MatchData;
  /** A have row made a new drink instead. */
  fresh: boolean;
  onPick: (drinkId: string) => void;
  onMatch: () => void;
  onUndoFresh: () => void;
}

/** One drink on the menu check: the printed line's crop, the drink, its state, its price. */
export function MenuLine({ row, files, data, fresh, onPick, onMatch, onUndoFresh }: MenuLineProps) {
  const crop = <SourceCrop file={fileAt(files, row.at)} box={row.at?.box} words={words('name' in row ? row.name : row.drink.name, row.ingredients)} />;
  const price = <Price value={row.printed} />;
  if (row.status === 'pick') {
    return (
      <ReviewRow
        state="pick"
        lead={crop}
        end={price}
        title={row.name}
        detail={row.options.length === 2 ? 'Which one? Two fit' : 'Which one?'}
        choices={row.options.map((o) => ({ id: o.id, label: o.name, detail: o.line || null }))}
        onChoose={onPick}
      />
    );
  }
  if (row.status === 'add' && !fresh) {
    return <ReviewRow state="have" lead={crop} end={price} title={row.drink.name} detail="In your bar" onPress={onMatch} pressHint="See or change the match" />;
  }
  if (row.status === 'add' || row.status === 'missing') {
    const name = row.status === 'add' ? row.drink.name : row.name;
    const n = row.ingredients.length;
    return (
      <ReviewRow
        state="new"
        lead={crop}
        end={price}
        title={name}
        detail={n ? `New drink · ${n} ${n === 1 ? 'ingredient' : 'ingredients'} read` : 'New drink'}
        action={fresh ? { label: 'Undo', hint: 'Use the drink you had', onPress: onUndoFresh } : undefined}
      >
        {n ? <NewDrinkPanel ingredients={row.ingredients} data={data} /> : null}
      </ReviewRow>
    );
  }
  return <ReviewRow state="skip" lead={crop} end={price} title={row.name} detail={row.note} />;
}

/** A line the reader left out (food), with Bring back. */
export function SkippedMenuLine({ line, files, onBringBack }: { line: SkippedLine; files: ReadFile[]; onBringBack: () => void }) {
  return (
    <ReviewRow
      state="skip"
      lead={<SourceCrop file={fileAt(files, line.at)} box={line.at?.box} words={line.name} />}
      end={<Price value={line.price} />}
      title={line.name}
      detail={`Skipped: ${line.why}`}
      action={{ label: 'Bring back', hint: `Puts ${line.name} on the menu`, onPress: onBringBack }}
    />
  );
}

const styles = StyleSheet.create({
  panel: { padding: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.control, gap: 2 },
  ingredient: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  flex: { flex: 1 },
});
