import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

/**
 * One choice on Publishing as tools-publishing draws it: a card with the
 * radio at its start (a ring, or a thick ring in the accent when picked), the
 * label and what it means. The picked card is raised, edged in the accent.
 */
export function RadioCard({ label, detail, selected, disabled, onPress }: { label: string; detail?: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: selected ? ds.c.raised : ds.c.surface, borderColor: selected ? ds.accentFill.fill : ds.c.line },
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.radio, selected ? { borderWidth: 7, borderColor: ds.accentFill.fill } : { borderColor: withAlpha(ds.c.ink, 0.35) }]} aria-hidden />
      <View style={styles.text}>
        <Body style={styles.label}>{label}</Body>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
    </PressableScale>
  );
}

/** A small pill choice in a row (a menu's setting): a line, or edged and tinted in the accent when picked. */
export function RadioPill({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.pill,
        selected ? { borderColor: ds.accentFill.fill, backgroundColor: withAlpha(ds.accentFill.fill, 0.16) } : { borderColor: ds.c.lineStrong },
        disabled && styles.disabled,
      ]}
    >
      <Caption style={selected ? styles.label : null}>{label}</Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md + 2, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, marginTop: 1 },
  text: { flex: 1, gap: space.xs },
  label: { fontFamily: fontFamilies.bodySemiBold },
  pill: { minHeight: 40, justifyContent: 'center', paddingHorizontal: space.md + 2, borderRadius: radius.pill, borderWidth: 1, minWidth: layout.minTapTarget },
  disabled: { opacity: 0.45 },
});
