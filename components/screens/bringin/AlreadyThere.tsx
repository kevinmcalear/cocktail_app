import { StyleSheet, View } from 'react-native';

import { Caption, DsText, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useSameNameDrink, type SameNameDrink } from '@/hooks/useSameNameDrink';
import { useCanEditItem } from '@/hooks/useViewAs';
import type { SheetPick } from '@/lib/bringInDraft';
import type { WizardDraft } from '@/lib/drinkWizard';
import { sheetWaits, specDifferences, storedLine, theirs, type SpecDifference } from '@/lib/sameName';

import { BracketField } from '@/components/screens/addDrink/SameNameCard';
import { WizardChip } from '@/components/screens/addDrink/WizardChrome';

import { MonoLabel } from './CheckParts';

export interface AlreadyThere {
  /** Whose it is ("Little Rye"). */
  bar: string;
  drink: SameNameDrink;
  differences: SpecDifference[];
  /** Save waits on a pick (true), has nothing to save ('same'), or can go (false). */
  waits: boolean | 'same';
  /** What the footer says while it waits. */
  note: string | null;
}

/**
 * A Bring in drink the venue already has by name (board dup-drink-warning):
 * the venue's drink and where the sheet's spec differs from it. Null when the
 * venue hasn't got one (or it's brought in at home).
 */
export function useAlreadyThere(barId: string | null, name: string, draft: WizardDraft, usual: string, pick: SheetPick | null | undefined): AlreadyThere | null {
  const bar = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'the venue';
  const drink = useSameNameDrink({ barId, name }).data ?? null;
  if (!barId || !drink) return null;
  const sheet = [...draft.lines, ...draft.garnishes].map((l) => ({ id: l.id, name: l.name, amount: l.amount, unit: l.unit }));
  const differences = specDifferences(sheet, drink.spec.map((l) => storedLine(l, usual)));
  const waits = sheetWaits(drink, differences, pick);
  const note = waits === 'same' ? `Already at ${bar} with the same spec, so there’s nothing to save` : waits ? `Pick what to do with the ${drink.name}` : null;
  return { bar, drink, differences, waits, note };
}

interface Props {
  there: AlreadyThere;
  pick: SheetPick | null | undefined;
  onPick: (pick: SheetPick | null) => void;
  /** Skip, in a review: moves on to the next drink. Without it, Skip is picked like the others. */
  onSkip?: () => void;
}

/**
 * "Already at Little Rye · a different spec": a compare of what differs, then
 * Update it (only for someone who can edit the venue's drinks), Keep both
 * (saved as a version, with a word in brackets) or Skip. With the same spec
 * there's nothing to do.
 */
export function AlreadyThereCard({ there, pick, onPick, onSkip }: Props) {
  const ds = useDs();
  const { bar, drink, differences } = there;
  const canUpdate = useCanEditItem({ id: drink.id, bar_id: drink.barId });
  if (!differences.length) {
    return (
      <View style={styles.status}>
        <IconSymbol name="checkmark" size={14} color={ds.c.muted} />
        <Caption tone="muted">{`Already at ${bar} · same spec`}</Caption>
      </View>
    );
  }
  const chosen = pick?.id === drink.id ? pick : null;
  const keep = chosen?.as === 'keep';
  const choose = (as: SheetPick['as']) => onPick({ id: drink.id, name: drink.name, bar, as, word: chosen?.word ?? '', riff: drink.classic ?? { id: drink.id, name: drink.name } });
  return (
    <View style={styles.stack}>
      <DsText variant="caption" color={keep ? ds.accentText : ds.c.muted}>
        {keep ? `New version of ${bar}’s` : `Already at ${bar} · a different spec`}
      </DsText>
      {keep ? null : (
        <View role="table" aria-label={`Where the sheet differs from ${theirs(bar, drink.name)}`} style={[styles.table, { backgroundColor: ds.c.surface }]}>
          <View role="row" style={styles.row}>
            <View style={styles.flex} />
            <MonoLabel style={styles.cell}>Sheet</MonoLabel>
            <MonoLabel style={styles.cell}>{bar}</MonoLabel>
          </View>
          {differences.map((d) => (
            <View role="row" key={d.name} style={styles.row}>
              <DsText variant="label" color={ds.c.ink} style={styles.flex} numberOfLines={1}>
                {d.name}
              </DsText>
              <DsText variant="label" color={ds.c.ink} style={[styles.cell, styles.mono]}>
                {d.sheet ?? '-'}
              </DsText>
              <DsText variant="label" color={ds.c.muted} style={[styles.cell, styles.mono]}>
                {d.bar ?? '-'}
              </DsText>
            </View>
          ))}
        </View>
      )}
      <View role="radiogroup" aria-label={`What to do with the ${drink.name}`} style={styles.chips}>
        {canUpdate ? <WizardChip label="Update it" selected={chosen?.as === 'update'} onPress={() => choose('update')} /> : null}
        <WizardChip label="Keep both" selected={keep} onPress={() => choose('keep')} />
        <WizardChip label="Skip" selected={chosen?.as === 'skip'} onPress={() => (onSkip ? onSkip() : choose('skip'))} />
      </View>
      {keep ? (
        <>
          <Caption tone="muted">What’s different about the sheet’s?</Caption>
          <BracketField value={chosen.word ?? ''} onChange={(word) => onPick({ ...chosen, word })} label="What’s different about the sheet’s" autoFocus={!chosen.word} />
          <Caption tone="muted">{`Saved next to ${theirs(bar, drink.name)}, which stays as it is.`}</Caption>
        </>
      ) : (
        <Caption tone="muted">
          {`${canUpdate ? `Update it: ${bar}’s takes the sheet’s spec. ` : ''}Keep both: the sheet’s is saved as a version. Skip: ${bar}’s stays as it is.`}
        </Caption>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm + 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  table: { borderRadius: radius.control, padding: space.md, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  cell: { width: 92 },
  mono: { fontFamily: fontFamilies.mono },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
