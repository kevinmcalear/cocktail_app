import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, PressableScale, Surface, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { layout, space } from '@/constants/tokens';

/** An uppercase, letter-spaced label above a group. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Caption tone="muted" role="heading" style={styles.title}>
      {children}
    </Caption>
  );
}

/** A titled group of venue settings on one card. */
export function BarSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionTitle>{title}</SectionTitle>
      <Surface style={styles.card}>
        {note ? <Caption tone="muted">{note}</Caption> : null}
        {children}
      </Surface>
    </View>
  );
}

/** A hairline between rows on a card. */
export function RowDivider() {
  const ds = useDs();
  return <View style={[styles.divider, { backgroundColor: ds.c.line }]} />;
}

/** A row that opens another screen: icon, label, a line of detail and a chevron. */
export function LinkRow({ icon, label, detail, onPress }: { icon: IconName; label: string; detail: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" onPress={onPress} accessibilityLabel={`${label}: ${detail}`} style={styles.row}>
      <IconSymbol name={icon} size={20} color={ds.c.ink} />
      <View style={styles.rowText}>
        <Body>{label}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/** One choice from a short list (a role level), as a wrapping row of chips. */
export function ChipGroup<T extends string | number>({ label, options, value, onPick, disabled }: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onPick: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View role="radiogroup" aria-label={label} style={styles.chips}>
      {options.map((o) => (
        <Chip key={String(o.value)} label={o.label} selected={o.value === value} disabled={disabled} onPress={() => o.value !== value && onPick(o.value)} />
      ))}
    </View>
  );
}

/** What went wrong, read out when it appears. Status red, never the accent. */
export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Caption color={STATUS.danger} role="alert">
      {children}
    </Caption>
  );
}

const styles = StyleSheet.create({
  title: { textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: space.xs },
  section: { gap: space.sm },
  card: { gap: space.md },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm },
  rowText: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
