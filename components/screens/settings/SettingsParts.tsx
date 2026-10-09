import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Chip, PressableScale, Surface, useDs, useGutter, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { backbar, layout, space } from '@/constants/tokens';

/**
 * A titled group of settings on one card, rows split by RowDivider. The page is
 * one column, so groups read top to bottom like a phone's Settings app. The
 * note sits under the card and says what the group is for.
 */
export function SettingsSection({ title, note, children }: { title?: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <SectionHeading>{title}</SectionHeading> : null}
      <Surface style={styles.card}>{children}</Surface>
      {note ? (
        <Caption tone="muted" style={styles.note}>
          {note}
        </Caption>
      ) : null}
    </View>
  );
}

/** The small uppercase label over a group, for a group that isn't one SettingsSection card. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Caption tone="muted" role="heading" style={styles.sectionTitle}>
      {children}
    </Caption>
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
  /** The current choice, shown at the end of the row. */
  value?: string;
}

/** One tappable row: a label, an optional detail line, and a chevron. */
export function SettingsRow({ label, detail, onPress, leading, icon, tone = 'ink', role = 'link', trailing, busy, disabled, expanded, value }: SettingsRowProps) {
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
      accessibilityLabel={[label, value, detail].filter(Boolean).join(', ')}
      style={styles.row}
    >
      {leading ?? (icon ? <IconSymbol name={icon} size={20} color={color} /> : null)}
      <View style={styles.rowText}>
        <Body color={color}>{label}</Body>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
      {value ? (
        <Body tone="muted" numberOfLines={1} style={styles.value}>
          {value}
        </Body>
      ) : null}
      {busy ? <ActivityIndicator color={color} /> : (trailing ?? <IconSymbol name={chevron} size={16} color={ds.c.muted} />)}
    </PressableScale>
  );
}

/** A short row of choices (System, Light, Dark), usually inside a ControlRow. */
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

/** A setting with its control at the end of the row; the control drops under the label when there isn't room. */
export function ControlRow({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return (
    <View style={[styles.row, styles.wrap]}>
      <View style={[styles.rowText, styles.wrapText]}>
        <Body>{label}</Body>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
      {children}
    </View>
  );
}

/** One choice from a list: the row shows the current one, and opens the list in place. */
export function SelectRow<T extends string>({ label, detail, options, value, onChange, disabled }: {
  label: string;
  detail?: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value)?.label;
  return (
    <View>
      <SettingsRow label={label} detail={detail} value={current} role="button" expanded={open} onPress={() => setOpen(!open)} />
      {open ? (
        <View style={styles.choices}>
          <ChoiceRows
            label={label}
            options={options}
            value={value}
            disabled={disabled}
            onChange={(id) => {
              onChange(id);
              setOpen(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

/** An on/off setting that saves as soon as it's flipped. */
export function SwitchRow({ label, detail, value, onValueChange, disabled }: { label: string; detail?: string; value: boolean; onValueChange: (on: boolean) => void; disabled?: boolean }) {
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
        disabled={disabled}
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

/**
 * Pinned under a settings page while it has unsaved edits: Discard and Save.
 * Render it after the page's ScrollView so it stays on screen.
 */
export function UnsavedBar({ saving, onDiscard, onSave, canSave = true, maxWidth = 680 }: {
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
  /** False while something on the page needs fixing first. */
  canSave?: boolean;
  maxWidth?: number;
}) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  return (
    <View
      role="region"
      aria-label="Unsaved changes"
      style={[styles.saveBar, { backgroundColor: ds.c.surface, borderTopColor: ds.c.line, paddingBottom: insets.bottom + space.md, paddingHorizontal: gutter }]}
    >
      <View style={[styles.saveRow, { maxWidth }]}>
        <Body tone="muted" style={styles.rowText}>
          Unsaved changes
        </Body>
        <Button label="Discard" variant="ghost" disabled={saving} onPress={onDiscard} />
        <Button label={saving ? 'Saving…' : 'Save'} disabled={saving || !canSave} onPress={onSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  saveBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
  saveRow: { width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: space.sm },
  section: { gap: space.sm },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: space.lg },
  note: { paddingHorizontal: space.lg },
  card: { paddingVertical: space.xs },
  value: { flexShrink: 1, maxWidth: '45%', textAlign: 'right' },
  wrap: { flexWrap: 'wrap', rowGap: space.sm, paddingVertical: space.sm },
  wrapText: { flexBasis: 200 },
  choices: { paddingLeft: space.lg, paddingBottom: space.sm },
  divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, paddingVertical: space.sm },
  rowText: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
