import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Switch, View } from 'react-native';

import { Body, Caption, Chip, PressableScale, Surface, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { backbar, layout, space } from '@/constants/tokens';

/** A titled group of settings on a card. Groups sit side by side when there's room. */
export function SettingsSection({ title, note, children, minWidth = 300 }: { title: string; note?: string; children: ReactNode; minWidth?: number }) {
  return (
    <View style={[styles.section, { flexBasis: minWidth, minWidth }]}>
      <Caption tone="muted" role="heading" style={styles.sectionTitle}>
        {title}
      </Caption>
      <Surface style={styles.card}>
        {note ? <Caption tone="muted">{note}</Caption> : null}
        {children}
      </Surface>
    </View>
  );
}

/** A hairline between rows in a section. */
export function RowDivider() {
  const ds = useDs();
  return <View style={[styles.divider, { backgroundColor: ds.c.line }]} />;
}

interface SettingsRowProps {
  label: string;
  detail?: string;
  onPress: () => void;
  /** Leading picture: a venue logo, say. */
  leading?: ReactNode;
  icon?: IconName;
  /** danger: deleting or leaving. Status red, never the accent. */
  tone?: 'ink' | 'danger';
  role?: 'link' | 'button';
  /** Replaces the chevron (a spinner while busy). */
  trailing?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  /** For a row that opens a panel in place. */
  expanded?: boolean;
}

/** One tappable row: a label, an optional detail line, and a chevron. */
export function SettingsRow({ label, detail, onPress, leading, icon, tone = 'ink', role = 'link', trailing, busy, disabled, expanded }: SettingsRowProps) {
  const ds = useDs();
  const color = tone === 'danger' ? STATUS.danger : ds.c.ink;
  const chevron = expanded === undefined ? 'chevron.right' : expanded ? 'chevron.down' : 'chevron.right';
  return (
    <PressableScale
      role={role}
      onPress={onPress}
      disabled={disabled || busy}
      aria-disabled={disabled || busy}
      aria-expanded={expanded}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={styles.row}
    >
      {leading ?? (icon ? <IconSymbol name={icon} size={20} color={color} /> : null)}
      <View style={styles.rowText}>
        <Body color={color}>{label}</Body>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
      {busy ? <ActivityIndicator color={color} /> : (trailing ?? <IconSymbol name={chevron} size={16} color={ds.c.muted} />)}
    </PressableScale>
  );
}

/** A short row of choices (System, Light, Dark). */
export function ChoiceChips<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <View role="radiogroup" aria-label={label} style={styles.chips}>
      {options.map((o) => (
        <Chip key={o.id} label={o.label} selected={value === o.id} onPress={() => onChange(o.id)} />
      ))}
    </View>
  );
}

/** A list of choices, one per row, with a tick on the chosen one. */
export function ChoiceRows<T extends string>({ label, options, value, onChange, disabled }: { label: string; options: readonly { id: T; label: string }[]; value: T; onChange: (id: T) => void; disabled?: boolean }) {
  const ds = useDs();
  return (
    <View role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const selected = value === o.id;
        return (
          <View key={o.id}>
            {i > 0 ? <RowDivider /> : null}
            <PressableScale
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled}
              disabled={disabled}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.id)}
              style={styles.row}
            >
              <Body style={styles.rowText}>{o.label}</Body>
              {selected ? <IconSymbol name="checkmark" size={18} color={ds.accentText} /> : null}
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

/** An on/off setting that saves as soon as it's flipped. */
export function SwitchRow({ label, detail, value, onValueChange }: { label: string; detail?: string; value: boolean; onValueChange: (on: boolean) => void }) {
  const ds = useDs();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Body>{label}</Body>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        aria-label={label}
        // Android's Switch ignores aria-label; this one reaches TalkBack.
        accessibilityLabel={label}
        trackColor={{ false: ds.c.lineStrong, true: ds.accentFill.fill }}
        // A white thumb on every platform; react-native-web colours the on
        // thumb from its own activeThumbColor (teal by default).
        thumbColor={backbar.light.surface}
        {...(Platform.OS === 'web' ? { activeThumbColor: backbar.light.surface } : null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { flexGrow: 1, maxWidth: '100%', gap: space.sm },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: space.xs },
  card: { gap: space.md },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm },
  rowText: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
