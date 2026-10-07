import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { PasteRow } from '@/lib/paste';

import { Choice } from './MenuSheet';

interface PhotoRowProps {
  row: PasteRow;
  onPick: (drinkId: string) => void;
  /** A drink that isn't in the library yet: finish it in Bring in. */
  onFinish: (name: string, ingredients: string[]) => void;
}

/** A text action in the venue's accent ("Add another page", "Finish"), at least 44 tall. */
export function TextLink({ label, onPress, accessibilityHint }: { label: string; onPress: () => void; accessibilityHint?: string }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={label} accessibilityHint={accessibilityHint} onPress={onPress} style={styles.link}>
      <DsText variant="body" color={ds.accentText}>
        {label}
      </DsText>
    </PressableScale>
  );
}

/** One drink read from the photo: matched (a check), new (a dashed plus), a pick, or skipped. */
export function PhotoRow({ row, onPick, onFinish }: PhotoRowProps) {
  const ds = useDs();
  if (row.status === 'pick') {
    return (
      <View style={[styles.pick, { borderBottomColor: ds.c.line }]}>
        <Body>{`${row.name}. Which one?`}</Body>
        {row.options.map((option) => (
          <Choice key={option.id} label={option.name} detail={option.line || option.kind} selected={false} onPress={() => onPick(option.id)} />
        ))}
      </View>
    );
  }
  const matched = row.status === 'add';
  const name = matched ? row.drink.name : row.name;
  const detail =
    row.status === 'add'
      ? ['Matched in your library', row.price ? `Price ${row.price}` : null].filter(Boolean).join(' · ')
      : row.status === 'missing'
        ? ['New', row.ingredients.join(', ')].filter(Boolean).join(' · ')
        : row.note;
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      {matched ? (
        <View style={[styles.mark, { backgroundColor: withAlpha(ds.accentText, 0.18) }]} aria-hidden>
          <IconSymbol name="checkmark" size={14} color={ds.accentText} />
        </View>
      ) : (
        <View style={[styles.mark, styles.dashed, { borderColor: ds.c.muted }, row.status === 'skip' && styles.faded]} aria-hidden>
          <IconSymbol name="plus" size={12} color={ds.c.muted} />
        </View>
      )}
      <View style={styles.flex}>
        <Body tone={row.status === 'skip' ? 'muted' : 'ink'}>{name}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
      {row.status === 'missing' ? <TextLink label="Finish" accessibilityHint={`Adds ${row.name} to the library`} onPress={() => onFinish(row.name, row.ingredients)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  pick: { gap: space.sm, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  mark: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed' },
  faded: { opacity: 0.5 },
  flex: { flex: 1, gap: 2 },
  link: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
