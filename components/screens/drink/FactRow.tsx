import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, space } from '@/constants/tokens';

interface FactRowProps {
  /** What the fact is, small above it: "Family", "First in print". */
  label: string;
  /** A short mark after the label in the accent, like a year or a count. */
  mark?: string | null;
  /** The whole row, read out. */
  accessibilityLabel: string;
  /** Opens a page. */
  onPress?: () => void;
  /** Or opens more under the row, in place. */
  more?: ReactNode;
  /** The fact, in a line or two. */
  children: ReactNode;
}

/**
 * One fact on the side of a drink page: a small label, the fact, and at most
 * one way deeper (a page, or more in place). Facts from the data only, never
 * a sentence the app works out for itself.
 */
export function FactRow({ label, mark, accessibilityLabel, onPress, more, children }: FactRowProps) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const head = (
    <>
      <View style={styles.text}>
        <Caption tone="muted" style={styles.label}>
          {label}
          {mark ? <Caption color={ds.accentText} style={styles.label}>{`  ${mark}`}</Caption> : null}
        </Caption>
        {children}
      </View>
      {more || onPress ? <IconSymbol name={more ? (open ? 'chevron.up' : 'chevron.down') : 'chevron.right'} size={16} color={ds.c.muted} /> : null}
    </>
  );
  const line = { borderTopColor: ds.c.line };

  if (more) {
    return (
      <View style={[styles.wrap, line]}>
        <PressableScale role="button" aria-expanded={open} accessibilityLabel={accessibilityLabel} onPress={() => setOpen((o) => !o)} style={styles.row}>
          {head}
        </PressableScale>
        {open ? <View style={styles.more}>{more}</View> : null}
      </View>
    );
  }
  if (onPress) {
    return (
      <PressableScale role="link" accessibilityLabel={accessibilityLabel} onPress={onPress} style={[styles.row, styles.wrap, line]}>
        {head}
      </PressableScale>
    );
  }
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={[styles.row, styles.wrap, line]}>
      {head}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.md },
  text: { flex: 1, minWidth: 0, gap: space.xs },
  label: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  more: { gap: space.md, paddingBottom: space.lg },
});
